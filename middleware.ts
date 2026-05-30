import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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

  // Logged in → check role and route accordingly
  if (user) {
    // Already authed hitting login → redirect to dashboard
    if (path === '/login' || path === '/') {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      const dest =
        profile?.role === 'teacher' ? '/teacher/dashboard' : '/student/dashboard'
      return NextResponse.redirect(new URL(dest, request.url))
    }

    // Teacher hitting student routes, or vice versa
    if (path.startsWith('/teacher') || path.startsWith('/student')) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (path.startsWith('/teacher') && profile?.role !== 'teacher') {
        return NextResponse.redirect(new URL('/student/dashboard', request.url))
      }
      if (path.startsWith('/student') && profile?.role !== 'student') {
        return NextResponse.redirect(new URL('/teacher/dashboard', request.url))
      }
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
