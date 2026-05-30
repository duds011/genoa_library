'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function deleteLesson(lessonId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { success: false, error: 'Not authenticated' }

  // Confirm this lesson belongs to the logged-in teacher
  const { data: lesson } = await supabase
    .from('lessons')
    .select('id, student_id, students ( id )')
    .eq('id', lessonId)
    .eq('teacher_id', user.id)
    .single()

  if (!lesson) return { success: false, error: 'Lesson not found' }

  // lesson_summaries has no ON DELETE CASCADE — delete it first
  await supabase.from('lesson_summaries').delete().eq('lesson_id', lessonId)

  // Delete the lesson — vocabulary_items, homework_items, lesson_sections all CASCADE
  const { error } = await supabase.from('lessons').delete().eq('id', lessonId)
  if (error) return { success: false, error: error.message }

  // Revalidate both the dashboard and the student detail page
  revalidatePath('/teacher/dashboard')
  const studentId = (lesson.students as any)?.id ?? lesson.student_id
  if (studentId) revalidatePath(`/teacher/students/${studentId}`)

  return { success: true }
}
