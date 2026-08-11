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

// Teacher rewrites a generated exercise during review.
//
// No furigana normalization here, unlike test questions: the student's practice
// section renders these fields as plain text, so bracket syntax would show up
// literally in the exercise instead of as a reading.
export async function updateExercise(input: {
  exerciseId: string
  prompt: string
  data: any
}): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  // RLS (exercises_teacher) restricts writes to the teacher's own lessons.
  const { error } = await supabase
    .from('lesson_exercises')
    .update({ prompt: input.prompt.trim(), data: input.data ?? {} })
    .eq('id', input.exerciseId)

  if (error) return { success: false, error: error.message }
  return { success: true }
}

// Teacher writes an exercise of her own, when the generated set isn't what she
// wants to set. It lands at the end of the lesson's list.
export async function createExercise(input: {
  lessonId: string
  type: 'read_aloud' | 'speak' | 'multiple_choice' | 'fill_blank'
  prompt: string
  data: any
}): Promise<{ success: boolean; error?: string; id?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { data: last } = await supabase
    .from('lesson_exercises')
    .select('sort_order')
    .eq('lesson_id', input.lessonId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: row, error } = await supabase
    .from('lesson_exercises')
    .insert({
      lesson_id: input.lessonId,
      type: input.type,
      prompt: input.prompt.trim(),
      data: input.data ?? {},
      sort_order: ((last as any)?.sort_order ?? 0) + 1,
    })
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }
  return { success: true, id: (row as any)?.id }
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
