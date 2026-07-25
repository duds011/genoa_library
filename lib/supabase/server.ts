import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { cache } from 'react'

const clean = (s?: string) => (s ?? '').replace(/^﻿/, '').trim()

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server component — cookies can be read-only
          }
        },
      },
    }
  )
}

/**
 * Request-memoized auth lookups.
 *
 * `cache()` dedupes these across a single server render, so a layout and the
 * page it wraps share ONE network call instead of each hitting Supabase again.
 * Previously getUser() ran ~3x per navigation (middleware + layout + page).
 */
export const getUser = cache(async () => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
})

export const getProfile = cache(async () => {
  const user = await getUser()
  if (!user) return null
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()
  return profile
})
