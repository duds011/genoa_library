import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const clean = (s?: string) => (s ?? '').replace(/^﻿/, '').trim()

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session — IMPORTANT: must come before any redirect
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname

  // Not logged in → redirect to login for protected routes
  if (!user && (path.startsWith('/teacher') || path.startsWith('/student'))) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Logged in and landing on / or /login → send to their dashboard.
  // This is the only place that needs the role here: there's no teacher/student
  // layout on these routes to do it. On the actual /teacher and /student routes
  // we deliberately DON'T re-query the role — the respective layouts already
  // fetch the profile and redirect on a mismatch (and RLS guards the data), so
  // repeating the query here was just an extra cross-region round-trip per click.
  if (user && (path === '/login' || path === '/')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const dest =
      profile?.role === 'teacher' ? '/teacher/dashboard' : '/student/dashboard'
    return NextResponse.redirect(new URL(dest, request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
