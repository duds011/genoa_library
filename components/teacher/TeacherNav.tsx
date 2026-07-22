'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BookOpen, Users, LayoutDashboard, LogOut, BarChart2, Wallet, StickyNote } from 'lucide-react'

const links = [
  { href: '/teacher/dashboard', label: 'Dashboard', short: 'Home', icon: LayoutDashboard },
  { href: '/teacher/students', label: 'Students', short: 'Students', icon: Users },
  { href: '/teacher/notes', label: 'Notes', short: 'Notes', icon: StickyNote },
  { href: '/teacher/payments', label: 'Payments', short: 'Pay', icon: Wallet },
  { href: '/teacher/analytics', label: 'Analytics', short: 'Stats', icon: BarChart2 },
]

/**
 * Five labelled links in a row don't fit a phone — they used to push the header
 * to 682px and drag every page sideways with them. On mobile the links move to
 * a fixed bottom bar (thumb-reachable, the native pattern); the top bar keeps
 * only the logo and sign-out. From md up it's the original single row.
 */
export default function TeacherNav({ teacherName }: { teacherName: string }) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <>
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          {/* Logo */}
          <Link href="/teacher/dashboard" className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}>
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-ink text-sm hidden sm:block">Teacher Portal</span>
          </Link>

          {/* Desktop nav links */}
          <nav className="hidden md:flex items-center gap-1">
            {links.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  pathname.startsWith(href)
                    ? 'bg-brand-50 text-brand-600'
                    : 'text-muted hover:bg-gray-100 hover:text-ink'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            ))}
          </nav>

          {/* User + sign out */}
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-xs text-muted hidden sm:block truncate max-w-[140px]">{teacherName}</span>
            <button onClick={handleSignOut} className="btn-ghost text-xs shrink-0" title="Sign out">
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile bottom bar. pb env(safe-area) keeps it clear of the iPhone home bar. */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-100 flex"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {links.map(({ href, short, icon: Icon }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors ${
                active ? 'text-brand-600' : 'text-muted'
              }`}
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span className="text-[10px] font-medium leading-none truncate max-w-full px-0.5">{short}</span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}
