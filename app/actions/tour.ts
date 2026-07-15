'use server'

import { createClient } from '@/lib/supabase/server'

// Marks the first-login tour as finished for the signed-in student, so it never
// plays again. Students have no UPDATE policy on their own row, so this goes
// through mark_student_tour_seen() — a SECURITY DEFINER function that touches
// only tour_completed_at (see supabase/migrations/003_student_tour.sql).
export async function completeStudentTour(): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { error } = await supabase.rpc('mark_student_tour_seen')
  if (error) return { success: false, error: error.message }
  return { success: true }
}
