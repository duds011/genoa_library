import { createAdminClient } from '@/lib/supabase/admin'
import { extractCandidateNames, matchStudent } from '@/lib/matchStudent'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/resolve-student
 * Called by n8n to match a raw filename / calendar title to a student.
 *
 * Body: { rawName: string, teacherId: string, transcript?: string, teacherName?: string }
 * Returns: { studentId: string | null, studentName: string, matchedBy: string }
 *
 * Pass the transcript when you have it — the attendee names inside it match
 * against student emails, which is far more reliable than the filename.
 *
 * Auth: requires x-n8n-secret header matching N8N_SECRET env var.
 */
export async function POST(req: NextRequest) {
  // Simple secret check so only your n8n workflow can call this
  const secret = req.headers.get('x-n8n-secret')
  if (!secret || secret !== process.env.N8N_SECRET) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const rawName: string = (body.rawName ?? '').trim()
  const teacherId: string = (body.teacherId ?? '').trim()
  const transcript: string = body.transcript ?? ''
  const teacherName: string = (body.teacherName ?? '').trim()

  if (!rawName || !teacherId) {
    return NextResponse.json({ message: 'rawName and teacherId are required' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: students, error } = await admin
    .from('students')
    .select('id, full_name, email')
    .eq('teacher_id', teacherId)

  if (error || !students) {
    return NextResponse.json({ message: 'Failed to fetch students' }, { status: 500 })
  }

  // Attendee names from the transcript first — they resolve against emails.
  // The filename is the last resort.
  const candidates = [
    ...extractCandidateNames(transcript, teacherName ? [teacherName] : []),
    rawName,
  ]

  const result = matchStudent(candidates, students)

  return NextResponse.json({
    studentId: result.studentId,
    studentName: result.studentName || rawName,
    matchedBy: result.matchedBy,
  })
}
