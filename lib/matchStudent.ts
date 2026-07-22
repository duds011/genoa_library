/**
 * Student matching for imported lesson transcripts.
 *
 * The Drive filename is unreliable — it comes from whatever the student named
 * themselves on the calendar booking ("Andy Andy", "Andrew Rapacke-Lesson 1").
 * Their email, however, is exact. Meet transcripts don't print emails, but they
 * do print the attendee's Google display name, and that name is usually inside
 * the email itself ("Andras Gladoun" → andrasgladoun@gmail.com), or the surname
 * lives in the email domain ("Rapacke" → andy@arapackelaw.com).
 *
 * So we collect every name we can see (transcript attendees, speaker labels,
 * filename) and score them against each student's name AND email.
 *
 * NOTE: the GENOA_Drive_Monitor n8n workflow ("Parse AI Response" node) runs a
 * plain-JS copy of this same algorithm. Keep the two in sync when editing.
 */

export type StudentRecord = {
  id: string
  full_name: string
  email?: string | null
}

export type MatchResult = {
  studentId: string | null
  studentName: string
  matchedBy: string
  score: number
  candidates: string[]
}

/** Email providers whose domain says nothing about the person's name. */
const GENERIC_EMAIL_DOMAINS = new Set([
  'gmail', 'googlemail', 'hotmail', 'outlook', 'live', 'msn', 'yahoo', 'ymail',
  'icloud', 'me', 'mac', 'aol', 'proton', 'protonmail', 'pm', 'gmx', 'web',
  'mail', 'zoho', 'yandex', 'qq', '163', 'naver',
])

/** Words that show up in filenames and are never part of a name. */
const NOISE_TOKENS = new Set([
  'lesson', 'lessons', 'transcript', 'transcripts', 'notes', 'meeting', 'call',
  'class', 'japanese', 'trial', 'and', 'with', 'jst', 'gmt', 'utc', 'zoom',
  'meet', 'google', 'recording', 'copy', 'final', 'draft', 'new',
])

const norm = (s: string) =>
  (s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '')

const tokenise = (s: string) =>
  (s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter(t => t.length >= 3 && !NOISE_TOKENS.has(t))

/** Everything about a student's email that could echo their name. */
function emailBlob(email?: string | null): string {
  if (!email) return ''
  const [rawLocal, rawDomain] = email.toLowerCase().split('@')
  const local = norm(rawLocal || '').replace(/\d+$/, '')
  const domainBase = (rawDomain || '').split('.')[0]
  const domain = GENERIC_EMAIL_DOMAINS.has(domainBase) ? '' : norm(domainBase)
  return local + domain
}

function emailLocal(email?: string | null): string {
  if (!email) return ''
  return norm(email.toLowerCase().split('@')[0] || '').replace(/\d+$/, '')
}

/**
 * Pull every plausible person-name out of a Meet transcript:
 * the "Attendees" line, plus the "Name: said something" speaker labels.
 */
export function extractCandidateNames(
  transcript: string,
  teacherNames: string[] = []
): string[] {
  const found: string[] = []
  const lines = (transcript || '').split(/\r?\n/)

  const attendeesIdx = lines.findIndex(l => /^attendees:?$/i.test(l.trim()))
  if (attendeesIdx >= 0) {
    for (const part of (lines[attendeesIdx + 1] || '').split(/[,、]/)) {
      found.push(part.trim())
    }
  }

  // Speaker labels — only scan the opening of the transcript, that's enough.
  for (const line of lines.slice(0, 300)) {
    const m = line.match(/^([^:]{2,40}):\s/)
    if (m && /[a-z]/i.test(m[1]) && tokenise(m[1]).length > 0) found.push(m[1].trim())
  }

  const teacher = new Set(teacherNames.map(norm).filter(Boolean))
  const seen = new Set<string>()
  const out: string[] = []
  for (const name of found) {
    const key = norm(name)
    if (!key || key.length < 3 || teacher.has(key) || seen.has(key)) continue
    seen.add(key)
    out.push(name.trim())
  }
  return out
}

/** How strongly does one observed name point at one student? 0 = no signal. */
function scoreCandidate(candidate: string, student: StudentRecord): [number, string] {
  const cn = norm(candidate)
  const nn = norm(student.full_name)
  if (!cn || !nn) return [0, '']

  if (cn === nn) return [100, 'exact name']

  // Length guard: a local-part like "andy" is a first name half the roster
  // shares, so it must not be allowed to decide a match on its own.
  const local = emailLocal(student.email)
  if (local.length >= 6 && cn === local) return [95, 'email local-part']

  const blob = emailBlob(student.email)
  const cTokens = tokenise(candidate)
  const sTokens = tokenise(student.full_name)
  const shared = cTokens.filter(t => sTokens.includes(t))

  // Surname present in both the name and the email — near-certain.
  if (blob && shared.some(t => t.length >= 5 && blob.includes(t))) {
    return [90, 'name token confirmed by email']
  }
  // Surname only reachable through the email (e.g. andy@arapackelaw.com).
  if (blob && cTokens.some(t => t.length >= 5 && blob.includes(t))) {
    return [85, 'token found in email']
  }
  if (shared.length >= 2) return [80, 'first and last name']
  if (shared.some(t => t.length >= 5)) return [70, 'distinctive name token']
  if (nn.length >= 6 && cn.includes(nn)) return [65, 'name contained in filename']

  return [0, '']
}

const MIN_SCORE = 65

/**
 * Pick the one student these observed names refer to.
 * Returns studentId: null when nothing scores high enough, or when two
 * different students tie — guessing wrong is worse than leaving it unassigned.
 */
export function matchStudent(
  candidates: string[],
  students: StudentRecord[]
): MatchResult {
  const cleaned = candidates.map(c => (c || '').trim()).filter(Boolean)
  const fallbackName = cleaned[cleaned.length - 1] || ''

  let best: { student: StudentRecord; score: number; reason: string } | null = null
  let runnerUpScore = 0

  for (const student of students) {
    let studentBest = 0
    let studentReason = ''
    for (const candidate of cleaned) {
      const [score, reason] = scoreCandidate(candidate, student)
      if (score > studentBest) {
        studentBest = score
        studentReason = reason
      }
    }
    if (studentBest === 0) continue

    if (!best || studentBest > best.score) {
      if (best) runnerUpScore = Math.max(runnerUpScore, best.score)
      best = { student, score: studentBest, reason: studentReason }
    } else {
      runnerUpScore = Math.max(runnerUpScore, studentBest)
    }
  }

  if (!best || best.score < MIN_SCORE || best.score === runnerUpScore) {
    return {
      studentId: null,
      studentName: fallbackName,
      matchedBy: best && best.score === runnerUpScore ? 'ambiguous' : 'no match',
      score: best?.score ?? 0,
      candidates: cleaned,
    }
  }

  return {
    studentId: best.student.id,
    studentName: best.student.full_name,
    matchedBy: best.reason,
    score: best.score,
    candidates: cleaned,
  }
}
