'use server'

import { createClient } from '@/lib/supabase/server'

export interface SubmitExerciseInput {
  exerciseId: string
  lessonId: string
  answer: unknown      // the student's chosen answer (option index, or filled word)
  isCorrect: boolean
}

export async function submitExercise(input: SubmitExerciseInput): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { data: student } = await supabase
    .from('students')
    .select('id')
    .eq('profile_id', user.id)
    .single()
  if (!student) return { success: false, error: 'Student not found' }

  const { error } = await supabase
    .from('exercise_submissions')
    .upsert(
      {
        exercise_id: input.exerciseId,
        lesson_id: input.lessonId,
        student_id: student.id,
        answer: input.answer as any,
        is_correct: input.isCorrect,
      },
      { onConflict: 'exercise_id,student_id' },
    )

  if (error) return { success: false, error: error.message }
  return { success: true }
}

// Teacher toggles whether the practice exercises are shown to the student.
export async function setExercisesVisibility(lessonId: string, show: boolean): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { error } = await supabase
    .from('lessons')
    .update({ show_exercises: show })
    .eq('id', lessonId)
    .eq('teacher_id', user.id)

  if (error) return { success: false, error: error.message }
  return { success: true }
}

// Teacher removes a generated exercise during review (RLS restricts to own lessons).
export async function deleteExercise(exerciseId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { error } = await supabase.from('lesson_exercises').delete().eq('id', exerciseId)
  if (error) return { success: false, error: error.message }
  return { success: true }
}
