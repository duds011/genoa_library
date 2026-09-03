import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { authenticateExtension } from '@/lib/ext-auth'
import { RECORDING_BUCKET, trackPath, transcriptPath, type CachedTranscript } from '@/lib/recap/ext-storage'
import { transcribeTracksDetailed, assembleTracks, toWhisperLanguage } from '@/lib/recap/whisper'
import { normalizeSegments } from '@/lib/recap/transcript'
import { toRealTime } from '@/lib/recap/cutmap'
import { generateRecap } from '@/lib/recap/openai'
import { saveRecap } from '@/lib/recap/save'

export const dynamic = 'force-dynamic'
/**
 * A 50-minute lesson is two tracks of audio to transcribe and then a long
 * completion. Whichever ceiling the host imposes, this must ask for the most
 * it can get — the work does not become shorter for being cut off.
 *
 * 300 is that ceiling on this project's Vercel plan; Lesson Studio asks for
 * 800 on Pro. A long lesson can therefore run out of time here, and when it
 * does the answer is to CALL THIS AGAIN with the same recordingId: the
 * transcript is cached in storage beside the audio, so a second attempt skips
 * the expensive half and finishes in seconds. The recorder retries once for
 * exactly this reason. Raising the plan removes the problem outright.
 */
export const maxDuration = 300

/**
 * Turn an uploaded recording into a draft recap.
 *
 * This is the recorder's replacement for the n8n pipeline. The difference that
 * matters is the input: n8n reads one undifferentiated Google Meet transcript,
 * where the extension uploads the teacher's microphone and the student's tab
 * as SEPARATE tracks. Every line is therefore attributed to whoever actually
 * said it, which is what makes talk-time, thinking time and per-speaker
 * corrections measurable rather than guessed at.
 *
 * The recap lands as a draft in the same place n8n's drafts land, so the
 * review-and-publish flow she already uses is unchanged.
 */
export async function POST(req: Request) {
  const caller = await authenticateExtension(req)
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { recordingId, studentId, seconds, lessonDate, heard, language, spokenLanguage, cutMaps } =
    await req.json().catch(() => ({}))
  if (!recordingId) return NextResponse.json({ error: 'Missing recordingId' }, { status: 400 })
  if (!studentId) return NextResponse.json({ error: 'Missing studentId' }, { status: 400 })

  const admin = createAdminClient()
  const { data: student } = await admin
    .from('students')
    .select('id, full_name, language')
    .eq('id', studentId)
    .eq('teacher_id', caller.teacherId)
    .maybeSingle()
  if (!student) return NextResponse.json({ error: 'Student not found for this teacher' }, { status: 404 })

  const date = (lessonDate && String(lessonDate).slice(0, 10)) || new Date().toISOString().slice(0, 10)

  try {
    const result = await buildRecap({
      admin, teacherId: caller.teacherId, student, recordingId,
      lessonDate: date, heard, language, spokenLanguage, cutMaps,
    })
    return NextResponse.json({ ok: true, ...result, student: student.full_name })
  } catch (e: any) {
    // The teacher sees this in the recorder, so it is a sentence rather than a
    // stack trace. The detail goes to the log.
    console.error(`[ext/complete] build failed for ${recordingId}:`, e?.message || e)
    return NextResponse.json(
      { error: 'The recording uploaded, but the recap could not be built. The audio is saved — try again from the portal.' },
      { status: 500 },
    )
  }
}

async function buildRecap({
  admin, teacherId, student, recordingId, lessonDate, heard, language, spokenLanguage, cutMaps,
}: any) {
  /**
   * The microphone is the teacher and the tab is the student.
   *
   * This portal has exactly one teacher, and she records her own lessons, so
   * there is no orientation to ask about — unlike Lesson Studio, where a
   * student may record themselves and the roles swap.
   */
  const wanted = [
    { track: 'mic', speaker: 'Teacher', isHost: true },
    { track: 'tab', speaker: student.full_name, isHost: false },
  ]

  // Seconds of real sound the recorder measured per track. A track that heard
  // essentially nothing is skipped: transcribing silence does not return an
  // empty result, it returns invented speech.
  const MIN_HEARD_SEC = 1.5
  const tracks: { blob: Blob; speaker: string; isHost: boolean; track: string }[] = []
  for (const w of wanted) {
    const loud = heard && typeof heard[w.track] === 'number' ? heard[w.track] : null
    if (loud !== null && loud < MIN_HEARD_SEC) continue

    const { data, error } = await admin.storage.from(RECORDING_BUCKET).download(trackPath(recordingId, w.track))
    if (error || !data) throw new Error(`Missing ${w.track} track: ${error?.message ?? 'not found'}`)
    if (data.size > 0) tracks.push({ blob: data, speaker: w.speaker, isHost: w.isHost, track: w.track })
  }
  if (!tracks.length) throw new Error('Both tracks were empty.')

  /**
   * Two different questions that must not share one answer.
   *
   * Whisper needs the language actually SPOKEN in the room — for a beginner
   * that is mostly English, and forcing Japanese onto it does not skip those
   * parts, it renders them as Japanese nonsense. The recap needs the language
   * being LEARNED, so it knows what counts as a learner error.
   */
  const code = toWhisperLanguage(spokenLanguage ?? language)
  const targetLanguage = student.language ?? 'Japanese'

  const det = await transcribeTracksDetailed(tracks, code)

  /**
   * Silence-stripped recordings arrive in compressed time. Every word is
   * shifted back onto the real lesson clock BEFORE interleaving, so speaker
   * order and talk-time are computed against the hour as it happened.
   */
  const remapped = det.words.map((w: any, i: number) => ({
    ...w,
    words: toRealTime(w.words, cutMaps?.[tracks[i].track] ?? null),
  }))
  const t = normalizeSegments(assembleTracks(remapped).filtered)
  if (!t.plain.trim()) throw new Error('Nothing was said on either track.')

  /**
   * Keep the words beside the audio they came from. Transcription is the
   * expensive half of a recap, so rebuilding one under a better prompt should
   * not mean paying to hear the lesson again. Best-effort: the recap in hand
   * is worth more than the cache.
   */
  const cache: CachedTranscript = {
    v: 1,
    language: code ?? null,
    createdAt: new Date().toISOString(),
    tracks: Object.fromEntries(remapped.map((w: any, i: number) => [tracks[i].track, w.words])),
  }
  const { error: cacheError } = await admin.storage
    .from(RECORDING_BUCKET)
    .upload(transcriptPath(recordingId), JSON.stringify(cache), {
      contentType: 'application/json',
      upsert: true,
    })
  if (cacheError) console.warn(`[ext/complete] could not cache transcript: ${cacheError.message}`)

  const recap: any = await generateRecap({
    studentName: student.full_name,
    transcript: t.plain,
    language: targetLanguage,
  })

  // Measured, not estimated — this is the half a Meet transcript cannot give.
  if (t.studentTalkPct != null) recap.talk_percentage = t.studentTalkPct
  recap.metrics = t.metrics

  const saved = await saveRecap({
    teacherId,
    studentId: student.id,
    lessonDate,
    recap,
    transcript: t.plain,
    source: 'recorder',
  })

  return { lessonId: saved.lessonId, created: saved.created }
}
