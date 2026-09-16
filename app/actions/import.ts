'use server'

import { createClient } from '@/lib/supabase/server'
import { generateRecap } from '@/lib/recap/openai'
import { saveRecap } from '@/lib/recap/save'

export interface ImportResult {
  success: boolean
  message?: string
  lessonId?: string
  error?: string
}

/**
 * Combine what the teacher pasted into the one string the model reads.
 *
 * The notes are labelled rather than concatenated. The recap prompt asks for
 * verbatim quotes of what the student SAID, and Gemini's summary is written in
 * the third person — merged silently, the model quotes the summary back as
 * speech and invents corrections for sentences nobody uttered.
 */
function buildSource(transcript: string, geminiNotes?: string): string {
  const parts: string[] = []
  const t = (transcript ?? '').trim()
  const n = (geminiNotes ?? '').trim()
  if (t) parts.push(t)
  if (n) {
    parts.push(
      [
        '--- Meeting notes (summary written after the lesson, NOT spoken by anyone) ---',
        'Use these for topic structure only. Never quote them as something the student said.',
        n,
      ].join('\n')
    )
  }
  return parts.join('\n\n')
}

/**
 * Turn a pasted transcript into a draft recap.
 *
 * This is the backup path for a lesson the recorder extension did not capture —
 * a Google Meet hour where Gemini produced the transcript instead. It runs the
 * SAME engine the recorder uses (generateRecap → saveRecap), so the draft lands
 * on the overview looking like every other draft.
 *
 * What it cannot do is measure. A Meet transcript is one undifferentiated
 * stream, so talk-time here is the model's estimate and per-speaker metrics are
 * absent — the recorder's two separate tracks are what make those real.
 */
export async function importTranscript(data: {
  studentId: string
  lessonDate: string
  transcript: string
  geminiNotes?: string
}): Promise<ImportResult> {
  // Verify the caller is the logged-in teacher
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { success: false, error: 'Not authenticated' }

  // Verify teacher role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!profile || profile.role !== 'teacher') {
    return { success: false, error: 'Unauthorized' }
  }

  // Confirm this student belongs to this teacher. `*` rather than a column
  // list, for the same reason the extension route does it: the language
  // columns arrived in a later migration.
  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('*')
    .eq('id', data.studentId)
    .eq('teacher_id', user.id)
    .single()
  if (studentError || !student) {
    return { success: false, error: 'Student not found' }
  }

  const source = buildSource(data.transcript, data.geminiNotes)
  if (!source) return { success: false, error: 'Paste a transcript or the meeting notes first.' }

  try {
    const recap = await generateRecap({
      studentName: student.full_name,
      transcript: source,
      language: student.language ?? 'Japanese',
    })

    const saved = await saveRecap({
      teacherId: user.id,
      studentId: student.id,
      lessonDate: data.lessonDate,
      recap,
      transcript: source,
      source: 'import',
    })

    return {
      success: true,
      lessonId: saved.lessonId,
      message: saved.created
        ? `Lesson for ${student.full_name} is ready as a draft — review it and publish when it looks right.`
        : `${student.full_name} already had a lesson on that date, so this replaced it. The draft is ready to review.`,
    }
  } catch (e: any) {
    // She sees this, so it is a sentence. The real error goes to the log.
    console.error('[import] recap build failed:', e?.message || e)
    return {
      success: false,
      error: 'The transcript could not be turned into a recap. The text is still in the box — try processing it again.',
    }
  }
}
