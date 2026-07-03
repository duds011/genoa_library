'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface PaymentResult {
  success: boolean
  error?: string
}

export interface PaymentInput {
  amount: number
  status: 'paid' | 'pending'
  description?: string
  lessons_covered?: number | null
  payment_date?: string | null
  due_date?: string | null
  method?: string | null
}

// Verify the logged-in teacher owns this student. Returns the supabase client + teacher id.
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

// Verify the teacher owns the student a given payment belongs to.
async function authorizePayment(paymentId: string) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Not authenticated' as const }

  const { data: payment, error } = await supabase
    .from('payments')
    .select('id, student_id')
    .eq('id', paymentId)
    .eq('teacher_id', user.id)
    .single()

  if (error || !payment) return { error: 'Payment not found' as const }
  return { supabase, userId: user.id, studentId: payment.student_id as string }
}

function sanitize(input: PaymentInput) {
  return {
    amount: input.amount,
    status: input.status,
    description: input.description?.trim() || null,
    lessons_covered: input.lessons_covered ?? null,
    payment_date: input.status === 'paid' ? (input.payment_date || null) : null,
    due_date: input.due_date || null,
    method: input.method?.trim() || null,
  }
}

// Sentinels used by the client for non-student income rows.
const OTHER_ID = '__other__'
const TRIAL_ID = '__trial__'

export async function addPayment(studentId: string, input: PaymentInput): Promise<PaymentResult> {
  if (!(input.amount > 0)) return { success: false, error: 'Amount must be greater than zero' }

  const isNonStudent = !studentId || studentId === OTHER_ID || studentId === TRIAL_ID
  const category = studentId === TRIAL_ID ? 'trial' : (isNonStudent ? 'other' : null)

  // Non-student income (Other / Trials) isn't tied to a student — just verify auth.
  let supabase, userId: string
  if (isNonStudent) {
    supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return { success: false, error: 'Not authenticated' }
    userId = user.id
  } else {
    const auth = await authorizeStudent(studentId)
    if ('error' in auth) return { success: false, error: auth.error }
    supabase = auth.supabase
    userId = auth.userId
  }

  // Inherit the teacher's currency preference for this payment.
  const { data: profile } = await supabase
    .from('profiles')
    .select('currency')
    .eq('id', userId)
    .single()

  const { error } = await supabase.from('payments').insert({
    student_id: isNonStudent ? null : studentId,
    teacher_id: userId,
    currency: profile?.currency ?? 'EUR',
    category,
    ...sanitize(input),
  })

  if (error) return { success: false, error: error.message }
  if (!isNonStudent) revalidatePath(`/teacher/students/${studentId}`)
  revalidatePath('/teacher/payments')
  return { success: true }
}

export async function updatePayment(paymentId: string, input: PaymentInput): Promise<PaymentResult> {
  if (!(input.amount > 0)) return { success: false, error: 'Amount must be greater than zero' }

  const auth = await authorizePayment(paymentId)
  if ('error' in auth) return { success: false, error: auth.error }

  const { error } = await auth.supabase
    .from('payments')
    .update(sanitize(input))
    .eq('id', paymentId)
    .eq('teacher_id', auth.userId)

  if (error) return { success: false, error: error.message }
  revalidatePath(`/teacher/students/${auth.studentId}`)
  revalidatePath('/teacher/payments')
  return { success: true }
}

// Quick action: mark a pending payment as paid (sets payment_date to today).
export async function markPaymentPaid(paymentId: string): Promise<PaymentResult> {
  const auth = await authorizePayment(paymentId)
  if ('error' in auth) return { success: false, error: auth.error }

  const today = new Date().toISOString().slice(0, 10)
  const { error } = await auth.supabase
    .from('payments')
    .update({ status: 'paid', payment_date: today })
    .eq('id', paymentId)
    .eq('teacher_id', auth.userId)

  if (error) return { success: false, error: error.message }
  revalidatePath(`/teacher/students/${auth.studentId}`)
  revalidatePath('/teacher/payments')
  return { success: true }
}

export async function deletePayment(paymentId: string): Promise<PaymentResult> {
  const auth = await authorizePayment(paymentId)
  if ('error' in auth) return { success: false, error: auth.error }

  const { error } = await auth.supabase
    .from('payments')
    .delete()
    .eq('id', paymentId)
    .eq('teacher_id', auth.userId)

  if (error) return { success: false, error: error.message }
  revalidatePath(`/teacher/students/${auth.studentId}`)
  revalidatePath('/teacher/payments')
  return { success: true }
}

export async function updateTeacherCurrency(currency: string): Promise<PaymentResult> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { success: false, error: 'Not authenticated' }

  const { error } = await supabase
    .from('profiles')
    .update({ currency })
    .eq('id', user.id)

  if (error) return { success: false, error: error.message }
  revalidatePath('/teacher/payments')
  return { success: true }
}
