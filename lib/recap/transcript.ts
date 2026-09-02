/**
 * PORTED FROM LESSON STUDIO — koku-library.app, lib/transcript.ts
 *
 * The recap engine this portal now runs on. It was written for Lesson Studio
 * and copied here rather than shared, because the two apps are separate
 * products on separate databases and neither should be able to take the other
 * down. The cost of that choice is this: these files exist twice, and a fix
 * made in one is not a fix in the other. Change them in step.
 */

/**
 * Transcript normalization + Tier-1 fluency metrics.
 *
 * The extension recorder transcribes its two tracks with Whisper (lib/whisper)
 * and hands speaker-attributed word segments in here; any source of the same
 * shape measures identically. Metrics come purely from the word-level
 * timestamps — no audio processing, no extra API cost.
 */

export type LessonMetrics = {
  studentWpm: number | null // student words per minute of student speech
  avgResponseSec: number | null // avg thinking time: teacher stops → student starts
  fillerCount: number // hesitation words in student speech (えーと, あの, um…)
  longPauseCount: number // mid-utterance silences ≥ 1.5s in student speech
  studentTurns: number // number of student speaking turns
  avgTurnWords: number | null // avg words per student turn
  longestTurnSec: number | null // longest unbroken student stretch (seconds)
  lessonVocab: number // measured distinct content words across the whole lesson
  studentVocab: number // measured distinct content words the student produced
}

// Grammatical glue + copulas we don't count as "vocabulary".
const NON_VOCAB = new Set(['は', 'を', 'が', 'に', 'の', 'へ', 'と', 'も', 'で', 'や', 'か', 'ね', 'よ', 'わ', 'さ', 'ん', 'な', 'だ', 'です', 'ます', 'the', 'a', 'an', 'is', 'to', 'of', 'and'])
const normToken = (t: string) => t.replace(/[\s、。，．・！？!?;:…「」『』（）()\[\]{}"'’“”~〜ー－—\-.,]/g, '').toLowerCase()
function isVocab(raw: string): string | null {
  const w = normToken(raw)
  if (!w || NON_VOCAB.has(w) || FILLERS.includes(w)) return null
  return w
}

export type TranscriptResult = {
  lines: string[] // "Speaker: text"
  plain: string // joined transcript for the LLM
  talk: { name: string; isHost: boolean; seconds: number }[]
  studentTalkPct: number | null
  metrics: LessonMetrics
}

/**
 * Hesitation words, across the languages this app teaches in.
 *
 * This list was Japanese plus four English words, so a French lesson counted
 * almost nothing and reported a confident zero — the most flattering possible
 * number, and the least true. A student saying "euh" every other sentence was
 * shown as having no hesitation at all.
 *
 * One list rather than one per language: a beginner's hour runs in two
 * languages at once, and their hesitations come in both.
 */
const FILLERS = [
  // Japanese
  'えーと', 'えー', 'ええと', 'えっと',
  'あのー', 'あの', 'そのー', 'んー',
  'まあ', 'なんか',
  // English
  'um', 'uh', 'erm', 'hmm', 'like',
  // French
  'euh', 'ben', 'bah', 'bof', 'enfin', 'genre',
  // Spanish / Portuguese
  'este', 'pues', 'bueno', 'eh', 'entonces', 'tipo',
  // Italian / German
  'allora', 'ähm', 'also',
]
function countFillers(text: string): number {
  const lower = text.toLowerCase()
  let n = 0
  for (const f of FILLERS) {
    const re = /[a-z]/.test(f) ? new RegExp(`\\b${f}\\b`, 'g') : new RegExp(f, 'g')
    n += (lower.match(re) || []).length
  }
  return n
}

/**
 * Turn speaker-attributed word segments into lines, talk time and metrics.
 * Shape: [{ participant: { name, is_host }, words: [{ text, start_timestamp:
 * { relative }, end_timestamp: { relative } }] }]
 */
export function normalizeSegments(segments: any[]): TranscriptResult {
  const lines: string[] = []
  const secByName: Record<string, number> = {}
  const hostByName: Record<string, boolean> = {}

  // Structured, time-ordered turns so we can measure pace, pauses and latency.
  type Turn = { name: string; isHost: boolean; text: string; start: number; end: number; words: { t: string; s: number; e: number }[] }
  const turns: Turn[] = []

  for (const seg of segments) {
    const name = seg.participant?.name || 'Unknown'
    hostByName[name] = !!seg.participant?.is_host
    const rawWords = seg.words || []
    if (!rawWords.length) continue
    const words = rawWords.map((w: any) => ({
      t: String(w.text ?? ''),
      s: w.start_timestamp?.relative ?? 0,
      e: w.end_timestamp?.relative ?? (w.start_timestamp?.relative ?? 0),
    }))
    const text = words.map((w: { t: string }) => w.t).join(' ')
    const start = words[0].s
    const end = words[words.length - 1].e
    lines.push(`${name}: ${text}`)
    secByName[name] = (secByName[name] ?? 0) + Math.max(0, end - start)
    turns.push({ name, isHost: hostByName[name], text, start, end, words })
  }

  const talk = Object.keys(secByName).map((name) => ({
    name,
    isHost: hostByName[name],
    seconds: Math.round(secByName[name]),
  }))
  const studentSec = talk.filter((t) => !t.isHost).reduce((a, b) => a + b.seconds, 0)
  const totalSec = talk.reduce((a, b) => a + b.seconds, 0)
  const studentTalkPct = totalSec > 0 ? Math.round((studentSec / totalSec) * 100) : null

  const metrics = computeMetrics(turns.sort((a, b) => a.start - b.start), studentSec)
  return { lines, plain: lines.join('\n'), talk, studentTalkPct, metrics }
}

type MTurn = { isHost: boolean; text: string; start: number; end: number; words: { t: string; s: number; e: number }[] }
function computeMetrics(turns: MTurn[], studentSec: number): LessonMetrics {
  const student = turns.filter((t) => !t.isHost)

  // WPM over student speaking time only.
  const studentWords = student.reduce((a, t) => a + t.words.length, 0)
  const studentWpm = studentSec > 2 ? Math.round((studentWords / studentSec) * 60) : null

  // Response latency: teacher turn immediately followed by a student turn.
  const gaps: number[] = []
  for (let i = 1; i < turns.length; i++) {
    if (turns[i - 1].isHost && !turns[i].isHost) {
      const gap = turns[i].start - turns[i - 1].end
      if (gap >= 0 && gap < 30) gaps.push(gap) // ignore negatives (overlap) and long off-topic breaks
    }
  }
  const avgResponseSec = gaps.length ? Math.round((gaps.reduce((a, b) => a + b, 0) / gaps.length) * 10) / 10 : null

  // Fillers + long mid-utterance pauses in student speech.
  let fillerCount = 0
  let longPauseCount = 0
  let longestTurnSec = 0
  for (const t of student) {
    fillerCount += countFillers(t.text)
    for (let i = 1; i < t.words.length; i++) {
      if (t.words[i].s - t.words[i - 1].e >= 1.5) longPauseCount++
    }
    longestTurnSec = Math.max(longestTurnSec, t.end - t.start)
  }

  const studentTurns = student.length
  const avgTurnWords = studentTurns ? Math.round(studentWords / studentTurns) : null

  // Measured vocabulary: distinct content words actually spoken this lesson.
  const lessonSet = new Set<string>()
  const studentSet = new Set<string>()
  for (const t of turns) {
    for (const w of t.words) {
      const v = isVocab(w.t)
      if (!v) continue
      lessonSet.add(v)
      if (!t.isHost) studentSet.add(v)
    }
  }

  return {
    studentWpm,
    avgResponseSec,
    fillerCount,
    longPauseCount,
    studentTurns,
    avgTurnWords,
    longestTurnSec: studentTurns ? Math.round(longestTurnSec) : null,
    lessonVocab: lessonSet.size,
    studentVocab: studentSet.size,
  }
}
