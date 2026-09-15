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
    /**
     * Never let a read of this database be answered from a cache.
     *
     * A PostgREST select is an ordinary GET, and Next patches `fetch` so that
     * GETs are stored in its Data Cache. The key is the URL, and a roster query
     * has the same URL every time, so the first answer it ever gave was still
     * being handed back weeks later: `/api/ext/students` served the recorder a
     * list from early September — a student archived on the 11th still in it, a
     * student added on the 15th missing — while the site, the dashboard and
     * `/api/ext/identify` all saw the real roster. `dynamic = 'force-dynamic'`
     * does not reach inside a library's own fetch, so it is said here, once,
     * for every admin read in the app.
     */
    global: {
      fetch: (input: RequestInfo | URL, init?: RequestInit) =>
        fetch(input, { ...init, cache: 'no-store' }),
    },
  })
}
