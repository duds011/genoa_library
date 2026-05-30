'use server'

import { createClient } from '@/lib/supabase/server'

export interface ImportResult {
  success: boolean
  message?: string
  error?: string
}

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

  // Confirm this student belongs to this teacher
  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('id, full_name')
    .eq('id', data.studentId)
    .eq('teacher_id', user.id)
    .single()
  if (studentError || !student) {
    return { success: false, error: 'Student not found' }
  }

  if (!data.transcript.trim()) {
    return { success: false, error: 'Transcript cannot be empty' }
  }

  const webhookUrl = process.env.N8N_WEBHOOK_URL
  if (!webhookUrl) {
    return { success: false, error: 'Webhook URL not configured (N8N_WEBHOOK_URL missing)' }
  }

  // POST to n8n GENOA_Lesson_Processor webhook
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      studentId: data.studentId,
      lessonDate: data.lessonDate,
      transcript: data.transcript,
      geminiNotes: data.geminiNotes || null,
      driveFileId: null,
    }),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => 'No details')
    return { success: false, error: `Webhook responded with ${response.status}: ${text}` }
  }

  return {
    success: true,
    message: `Lesson for ${student.full_name} is being processed. It will appear as a draft in ~15 seconds.`,
  }
}
