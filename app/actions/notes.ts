'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface NoteResult {
  success: boolean
  error?: string
}

// Verify the logged-in teacher owns this student. Returns the teacher's user id.
async function authorizeStudent(studentId: string) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Not authenticated' as const }

  const { data: student, error } = await supabase
    .from('students')
    .select('id')
    .eq('id', studentId)
    .eq('teacher_id', user.id)
    .single()

  if (error || !student) return { error: 'Student not found' as const }
  return { supabase, userId: user.id }
}

export async function addStudentNote(studentId: string, content: string, noteDate?: string): Promise<NoteResult> {
  const trimmed = content.trim()
  if (!trimmed) return { success: false, error: 'Note cannot be empty' }

  const auth = await authorizeStudent(studentId)
  if ('error' in auth) return { success: false, error: auth.error }

  const { error } = await auth.supabase.from('student_notes').insert({
    student_id: studentId,
    teacher_id: auth.userId,
    content: trimmed,
    note_date: noteDate || new Date().toISOString().slice(0, 10),
  })

  if (error) return { success: false, error: error.message }
  revalidatePath('/teacher/notes')
  return { success: true }
}

export async function updateStudentNote(noteId: string, studentId: string, content: string, noteDate?: string): Promise<NoteResult> {
  const trimmed = content.trim()
  if (!trimmed) return { success: false, error: 'Note cannot be empty' }

  const auth = await authorizeStudent(studentId)
  if ('error' in auth) return { success: false, error: auth.error }

  const fields: { content: string; note_date?: string } = { content: trimmed }
  if (noteDate) fields.note_date = noteDate

  const { error } = await auth.supabase
    .from('student_notes')
    .update(fields)
    .eq('id', noteId)
    .eq('teacher_id', auth.userId)

  if (error) return { success: false, error: error.message }
  revalidatePath('/teacher/notes')
  return { success: true }
}

export async function toggleNotePin(noteId: string, studentId: string, pinned: boolean): Promise<NoteResult> {
  const auth = await authorizeStudent(studentId)
  if ('error' in auth) return { success: false, error: auth.error }

  const { error } = await auth.supabase
    .from('student_notes')
    .update({ pinned })
    .eq('id', noteId)
    .eq('teacher_id', auth.userId)

  if (error) return { success: false, error: error.message }
  revalidatePath('/teacher/notes')
  return { success: true }
}

export async function deleteStudentNote(noteId: string, studentId: string): Promise<NoteResult> {
  const auth = await authorizeStudent(studentId)
  if ('error' in auth) return { success: false, error: auth.error }

  const { error } = await auth.supabase
    .from('student_notes')
    .delete()
    .eq('id', noteId)
    .eq('teacher_id', auth.userId)

  if (error) return { success: false, error: error.message }
  revalidatePath('/teacher/notes')
  return { success: true }
}
