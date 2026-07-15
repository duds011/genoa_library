'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notifyStudentOfSpeakingFeedback } from '@/app/actions/notifications'

export async function sendAudioFeedback(
  submissionId: string,
  feedback: string,
  feedbackAudioUrl?: string | null,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const trimmed = feedback.trim()
  if (!trimmed && !feedbackAudioUrl) return { success: false, error: 'Add text or audio feedback' }

  const admin = createAdminClient()

  // Verify the teacher owns the lesson this recording belongs to.
  const { data: sub } = await admin
    .from('student_audio_submissions')
    .select('id, lesson_id')
    .eq('id', submissionId)
    .single()
  if (!sub) return { success: false, error: 'Recording not found' }

  const { data: lesson } = await admin
    .from('lessons')
    .select('teacher_id')
    .eq('id', sub.lesson_id)
    .single()
  if (!lesson || lesson.teacher_id !== user.id) return { success: false, error: 'Not authorized' }

  const { error } = await admin
    .from('student_audio_submissions')
    .update({
      teacher_feedback: trimmed || null,
      feedback_audio_url: feedbackAudioUrl ?? null,
      feedback_sent_at: new Date().toISOString(),
    })
    .eq('id', submissionId)

  if (error) return { success: false, error: error.message }

  // Tell the student it's there. Not allowed to fail the save.
  await notifyStudentOfSpeakingFeedback(submissionId).catch(() => {})

  return { success: true }
}

// Audio feedback on a homework submission set (per lesson, mirrors text feedback).
export async function setHomeworkFeedbackAudio(
  lessonId: string,
  feedbackAudioUrl: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const admin = createAdminClient()
  const { data: lesson } = await admin
    .from('lessons')
    .select('teacher_id')
    .eq('id', lessonId)
    .single()
  if (!lesson || lesson.teacher_id !== user.id) return { success: false, error: 'Not authorized' }

  const { error } = await admin
    .from('homework_submissions')
    .update({ feedback_audio_url: feedbackAudioUrl, feedback_sent_at: new Date().toISOString() })
    .eq('lesson_id', lessonId)

  if (error) return { success: false, error: error.message }
  return { success: true }
}
