// The kinds of email Noa sends a student, and whether the student wants each.
//
// Opt-out: a category absent from email_prefs (or set to anything but false)
// counts as ON, so existing students keep receiving everything until they turn
// something off. email_enabled is the master switch.

export type EmailCategory = 'recap' | 'homework_feedback' | 'speaking_feedback' | 'tests'

// Order here is the order shown in the student's popover.
export const EMAIL_CATEGORIES: { key: EmailCategory; label: string; description: string }[] = [
  { key: 'recap',             label: 'New lesson recaps',   description: 'When Noa publishes the recap for a lesson.' },
  { key: 'homework_feedback', label: 'Homework feedback',   description: 'When Noa comments on the homework you submitted.' },
  { key: 'speaking_feedback', label: 'Speaking feedback',   description: 'When Noa replies to a speaking recording.' },
  { key: 'tests',             label: 'Tests & results',     description: 'When Noa shares a test with you, or marks it.' },
]

export const EMAIL_CATEGORY_KEYS = EMAIL_CATEGORIES.map(c => c.key)

export interface EmailPrefs {
  enabled: boolean
  // Only stores categories the student has changed; absent = on.
  prefs: Partial<Record<EmailCategory, boolean>>
}

/** A category is on unless the master switch is off or it was explicitly set false. */
export function categoryEnabled(prefs: EmailPrefs, category: EmailCategory): boolean {
  if (!prefs.enabled) return false
  return prefs.prefs[category] !== false
}

/** Reads a student row's raw columns into a usable EmailPrefs. */
export function readEmailPrefs(row: { email_enabled?: boolean | null; email_prefs?: unknown } | null): EmailPrefs {
  const raw = (row?.email_prefs && typeof row.email_prefs === 'object') ? row.email_prefs as Record<string, unknown> : {}
  const prefs: Partial<Record<EmailCategory, boolean>> = {}
  for (const key of EMAIL_CATEGORY_KEYS) {
    if (raw[key] === false) prefs[key] = false
  }
  return { enabled: row?.email_enabled !== false, prefs }
}

/**
 * Server-side gate: has this student opted out of `category`?
 *
 * Takes a Supabase client (admin, so it works from the send path where there is
 * no session) rather than importing one, keeping this module free of server-only
 * deps. Fails OPEN — if the lookup errors we send anyway, because a missed
 * unsubscribe is a smaller harm than silently dropping every student's mail.
 */
export async function studentEmailAllows(
  db: { from: (t: string) => any },
  studentId: string,
  category: EmailCategory,
): Promise<boolean> {
  try {
    const { data } = await db
      .from('students')
      .select('email_enabled, email_prefs')
      .eq('id', studentId)
      .single()
    return categoryEnabled(readEmailPrefs(data), category)
  } catch {
    return true
  }
}
