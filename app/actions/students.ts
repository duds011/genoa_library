'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/**
 * Archive or un-archive a student.
 *
 * Archiving is the gentle alternative to deleting: the student drops out of the
 * students list, the payments grid and the notes grid, but every lesson, note
 * and payment stays exactly where it was. Their past payments keep counting
 * toward revenue — a month's income shouldn't change because someone stopped
 * taking lessons afterwards.
 */
export async function setStudentArchived(
  studentId: string,
  archived: boolean
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { success: false, error: 'Not authenticated' }

  const { error } = await supabase
    .from('students')
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq('id', studentId)
    .eq('teacher_id', user.id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/teacher/students')
  revalidatePath('/teacher/payments')
  revalidatePath('/teacher/notes')
  revalidatePath('/teacher/dashboard')
  return { success: true }
}

export interface CreateStudentResult {
  success: boolean
  studentId?: string
  authUserId?: string
  tempPassword?: string   // returned only for retroactive setup
  error?: string
}

export async function createStudent(formData: {
  full_name: string
  email: string
  password: string
  language: string
  level: string
}): Promise<CreateStudentResult> {
  // 1. Verify the caller is the logged-in teacher
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Verify teacher role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'teacher') {
    return { success: false, error: 'Unauthorized' }
  }

  const admin = createAdminClient()

  // 2. Create the Supabase auth account for the student
  const { data: newUser, error: createError } = await admin.auth.admin.createUser({
    email: formData.email,
    password: formData.password,
    email_confirm: true,          // skip email verification — teacher sets password
    user_metadata: {
      full_name: formData.full_name,
    },
  })

  if (createError) {
    return { success: false, error: createError.message }
  }

  const authUserId = newUser.user.id

  // 3. Upsert the profile row (the trigger creates it, but set role explicitly)
  const { error: profileError } = await admin
    .from('profiles')
    .upsert({
      id: authUserId,
      role: 'student',
      full_name: formData.full_name,
      email: formData.email,
    })

  if (profileError) {
    // Roll back: delete the auth user we just created
    await admin.auth.admin.deleteUser(authUserId)
    return { success: false, error: profileError.message }
  }

  // 4. Insert the students table row (links student to teacher, sets profile_id)
  const { data: studentRow, error: studentError } = await admin
    .from('students')
    .insert({
      teacher_id: user.id,
      profile_id: authUserId,
      full_name: formData.full_name,
      email: formData.email,
      language: formData.language,
      level: formData.level,
    })
    .select('id')
    .single()

  if (studentError) {
    // Roll back: delete auth user
    await admin.auth.admin.deleteUser(authUserId)
    return { success: false, error: studentError.message }
  }

  return { success: true, studentId: studentRow.id, authUserId }
}

export async function createAuthForExistingStudent(studentId: string): Promise<CreateStudentResult> {
  // Used to retroactively create auth accounts for students added without one (e.g. James Coker)
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { success: false, error: 'Not authenticated' }

  // Load the student record
  const { data: student, error: loadError } = await supabase
    .from('students')
    .select('*')
    .eq('id', studentId)
    .eq('teacher_id', user.id)
    .single()

  if (loadError || !student) return { success: false, error: 'Student not found' }
  if (student.profile_id) return { success: false, error: 'Student already has an auth account' }

  const admin = createAdminClient()

  // Generate a temporary password
  const tempPassword = Math.random().toString(36).slice(-10) + 'A1!'

  const { data: newUser, error: createError } = await admin.auth.admin.createUser({
    email: student.email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name: student.full_name },
  })

  if (createError) return { success: false, error: createError.message }

  const authUserId = newUser.user.id

  // Upsert profile
  await admin.from('profiles').upsert({
    id: authUserId,
    role: 'student',
    full_name: student.full_name,
    email: student.email,
  })

  // Link profile_id in students table
  const { error: linkError } = await admin
    .from('students')
    .update({ profile_id: authUserId })
    .eq('id', studentId)

  if (linkError) {
    await admin.auth.admin.deleteUser(authUserId)
    return { success: false, error: linkError.message }
  }

  return { success: true, studentId, authUserId, tempPassword }
}

export interface ResetPasswordResult {
  success: boolean
  newPassword?: string
  error?: string
}

export async function deleteStudent(studentId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { success: false, error: 'Not authenticated' }

  // Verify teacher owns this student
  const { data: student, error: loadError } = await supabase
    .from('students')
    .select('id, profile_id')
    .eq('id', studentId)
    .eq('teacher_id', user.id)
    .single()

  if (loadError || !student) return { success: false, error: 'Student not found' }

  // Get all lesson IDs
  const { data: lessons } = await supabase
    .from('lessons')
    .select('id')
    .eq('student_id', studentId)

  if (lessons && lessons.length > 0) {
    const ids = lessons.map((l: { id: string }) => l.id)
    await supabase.from('lesson_summaries').delete().in('lesson_id', ids)
    await supabase.from('lesson_sections').delete().in('lesson_id', ids)
    await supabase.from('vocabulary_items').delete().in('lesson_id', ids)
    await supabase.from('homework_items').delete().in('lesson_id', ids)
    await supabase.from('lessons').delete().in('id', ids)
  }

  const { error: deleteError } = await supabase.from('students').delete().eq('id', studentId)
  if (deleteError) return { success: false, error: deleteError.message }

  // Clean up auth account if one exists
  if (student.profile_id) {
    try {
      const admin = createAdminClient()
      await admin.auth.admin.deleteUser(student.profile_id)
    } catch { /* non-fatal */ }
  }

  return { success: true }
}

export async function updateStudentEmail(
  studentId: string,
  newEmail: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { success: false, error: 'Not authenticated' }

  // Load student — verify teacher owns it
  const { data: student, error: loadError } = await supabase
    .from('students')
    .select('id, profile_id')
    .eq('id', studentId)
    .eq('teacher_id', user.id)
    .single()

  if (loadError || !student) return { success: false, error: 'Student not found' }

  const admin = createAdminClient()

  // 1. Update Supabase Auth email (if auth account exists)
  if (student.profile_id) {
    const { error: authUpdateError } = await admin.auth.admin.updateUserById(
      student.profile_id,
      { email: newEmail, email_confirm: true },
    )
    if (authUpdateError) return { success: false, error: authUpdateError.message }

    // 2. Update profiles table
    const { error: profileError } = await admin
      .from('profiles')
      .update({ email: newEmail })
      .eq('id', student.profile_id)
    if (profileError) return { success: false, error: profileError.message }
  }

  // 3. Update students table
  const { error: studentError } = await admin
    .from('students')
    .update({ email: newEmail })
    .eq('id', studentId)
  if (studentError) return { success: false, error: studentError.message }

  return { success: true }
}

export async function resetStudentPassword(studentId: string, newPassword: string): Promise<ResetPasswordResult> {
  // Verify teacher owns this student
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { success: false, error: 'Not authenticated' }

  const { data: student, error: loadError } = await supabase
    .from('students')
    .select('profile_id, full_name')
    .eq('id', studentId)
    .eq('teacher_id', user.id)
    .single()

  if (loadError || !student) return { success: false, error: 'Student not found' }
  if (!student.profile_id) return { success: false, error: 'Student has no auth account yet' }

  const admin = createAdminClient()
  const { error: updateError } = await admin.auth.admin.updateUserById(student.profile_id, {
    password: newPassword,
  })

  if (updateError) return { success: false, error: updateError.message }

  return { success: true, newPassword }
}
