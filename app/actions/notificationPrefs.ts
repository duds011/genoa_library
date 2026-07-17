'use server'

import { createClient } from '@/lib/supabase/server'
import { EMAIL_CATEGORY_KEYS, type EmailCategory, type EmailPrefs } from '@/lib/notificationPrefs'

// Saves the signed-in student's email preferences. Students have no UPDATE
// policy on their own row, so this goes through set_student_email_prefs() — a
// SECURITY DEFINER function that writes only the two preference columns
// (see supabase/migrations, student_email_prefs).
export async function saveMyEmailPrefs(input: {
  enabled: boolean
  prefs: Partial<Record<EmailCategory, boolean>>
}): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  // Only persist known categories, and only the ones turned OFF — an absent key
  // means "on", which keeps the stored object small and forward-compatible.
  const clean: Record<string, boolean> = {}
  for (const key of EMAIL_CATEGORY_KEYS) {
    if (input.prefs[key] === false) clean[key] = false
  }

  const { error } = await supabase.rpc('set_student_email_prefs', {
    p_enabled: input.enabled !== false,
    p_prefs: clean,
  })
  if (error) return { success: false, error: error.message }
  return { success: true }
}

export type { EmailPrefs }
