import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { authenticateExtension } from '@/lib/ext-auth'
import { matchStudent } from '@/lib/matchStudent'

export const dynamic = 'force-dynamic'

/**
 * Who is in this lesson?
 *
 * The recorder used to ask. It knew nothing about the call it was pointed at,
 * so every lesson began by choosing a name from a list of nineteen — and the
 * cost of getting it wrong is a recap filed against the wrong student, which
 * nobody notices until a student reads someone else's lesson.
 *
 * The browser already knows. A Google Meet call opened from a calendar invite
 * carries the event's title in the tab, and the call itself lists who joined.
 * Both are names, and this portal has always had a matcher for names — the
 * same one the Drive pipeline uses on filenames, which scores against each
 * student's full name AND their email, because a display name usually echoes
 * one or the other.
 *
 * Deliberately conservative: a weak or ambiguous match returns null and the
 * recorder falls back to asking. Guessing here would be worse than the list.
 */
export async function POST(req: Request) {
  const caller = await authenticateExtension(req)
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { names, title } = await req.json().catch(() => ({}))
  const given: string[] = [
    ...(Array.isArray(names) ? names : []),
    ...(typeof title === 'string' ? [title] : []),
  ]
    .map((n) => String(n ?? '').trim())
    .filter(Boolean)
    .slice(0, 40)

  if (given.length === 0) return NextResponse.json({ student: null, matchedBy: 'nothing to go on' })

  const admin = createAdminClient()
  const [{ data: students }, { data: profile }] = await Promise.all([
    admin
      .from('students')
      .select('id, full_name, email')
      .eq('teacher_id', caller.teacherId)
      .is('archived_at', null),
    admin.from('profiles').select('full_name').eq('id', caller.teacherId).maybeSingle(),
  ])
  if (!students?.length) return NextResponse.json({ student: null, matchedBy: 'no students' })

  // The teacher is in her own call and in her own calendar titles. Leaving her
  // in the candidates lets a title like "Noa & Andy" match on the wrong half.
  const teacherName = (profile as any)?.full_name ?? ''

  /**
   * Meet's own furniture reads like a name to a fuzzy matcher — "Meet",
   * "Google Meet", a room code — and a room code is nine letters in three
   * groups, which is exactly the shape of a name. Strip the chrome first.
   */
  const MEET_NOISE = /^(google\s+)?meet$|^\s*$|^[a-z]{3}-[a-z]{4}-[a-z]{3}$|^(you|presenting|meeting details)$/i
  const cleaned = given
    .flatMap((n) => n.replace(/^meet\s*[–—-]\s*/i, '').split(/\s+(?:&|and|with|\/|\+)\s+/i))
    .map((n) => n.replace(/\((?:you|host|guest)\)/gi, '').trim())
    .filter((n) => n && !MEET_NOISE.test(n))

  /**
   * Drop the teacher. She is in her own call and in her own calendar titles,
   * and a first name shared with a student would otherwise let "Noa & Andy"
   * match on the wrong half.
   *
   * Done here rather than through extractCandidateNames, which reads a
   * transcript — it looks for an "Attendees:" line and "Name: " speaker
   * labels, so a bare list of names goes in and nothing comes out.
   */
  const flat = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
  const teacherKeys = new Set(
    [teacherName, ...teacherName.split(/\s+/)].map(flat).filter((k) => k.length >= 3),
  )
  const candidates = cleaned.filter((n) => !teacherKeys.has(flat(n)))
  if (candidates.length === 0) {
    return NextResponse.json({
      student: null,
      matchedBy: cleaned.length ? 'only the teacher was named' : 'no name in the tab',
    })
  }

  const result = matchStudent(candidates, students)
  if (!result.studentId) {
    return NextResponse.json({ student: null, matchedBy: result.matchedBy || 'no confident match' })
  }

  const student = students.find((s) => s.id === result.studentId)!
  return NextResponse.json({
    student: { id: student.id, full_name: student.full_name },
    matchedBy: result.matchedBy,
  })
}
