import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/resolve-student
 * Called by n8n to fuzzy-match a raw filename/calendar title to a student.
 *
 * Body: { rawName: string, teacherId: string }
 * Returns: { studentId: string, studentName: string } | { studentId: null, studentName: string }
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

  if (!rawName || !teacherId) {
    return NextResponse.json({ message: 'rawName and teacherId are required' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: students, error } = await admin
    .from('students')
    .select('id, full_name')
    .eq('teacher_id', teacherId)

  if (error || !students) {
    return NextResponse.json({ message: 'Failed to fetch students' }, { status: 500 })
  }

  const normalised = rawName.toLowerCase()

  // Find the first student whose full_name appears anywhere in the raw string
  const match = students.find(s =>
    normalised.includes(s.full_name.toLowerCase())
  )

  if (match) {
    return NextResponse.json({ studentId: match.id, studentName: match.full_name })
  }

  // No match — return null so n8n can create the lesson as unassigned
  return NextResponse.json({ studentId: null, studentName: rawName })
}
