'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BookOpen, Users, LayoutDashboard, LogOut, BarChart2 } from 'lucide-react'

export default function TeacherNav({ teacherName }: { teacherName: string }) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const links = [
    { href: '/teacher/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/teacher/students', label: 'Students', icon: Users },
    { href: '/teacher/analytics', label: 'Analytics', icon: BarChart2 },
  ]

  return (
    <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/teacher/dashboard" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}>
            <BookOpen className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-ink text-sm hidden sm:block">Teacher Portal</span>
        </Link>

        {/* Nav links */}
        <nav className="flex items-center gap-1">
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
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted hidden sm:block">{teacherName}</span>
          <button onClick={handleSignOut} className="btn-ghost text-xs">
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>
      </div>
    </header>
  )
}
