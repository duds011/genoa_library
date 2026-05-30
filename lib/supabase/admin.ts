import { createClient } from '@supabase/supabase-js'

const clean = (s?: string) => (s ?? '').replace(/^﻿/, '').trim()

/**
 * Admin client — uses service role key, bypasses RLS.
 * Only import this in Server Actions or API routes — NEVER in client components.
 */
export function createAdminClient() {
  const url        = clean(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const serviceKey = clean(process.env.SUPABASE_SERVICE_ROLE_KEY)

  if (!url || !serviceKey) {
    throw new Error('Missing Supabase admin credentials')
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
