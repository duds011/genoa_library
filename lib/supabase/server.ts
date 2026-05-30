import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

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
