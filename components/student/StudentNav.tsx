'use client'

import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BookOpen, LogOut } from 'lucide-react'
import Link from 'next/link'

export default function StudentNav({ studentName }: { studentName: string }) {
  const router = useRouter()
  const pathname = usePathname()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}>
            <BookOpen className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-bold text-ink text-sm">Student View</span>
        </div>
        <div className="flex items-center gap-3">
          <nav className="hidden sm:flex items-center gap-1">
            <Link
              href="/student/dashboard"
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${pathname === '/student/dashboard' ? 'bg-brand-50 text-brand-600' : 'text-muted hover:bg-gray-50 hover:text-ink'}`}
            >
              Dashboard
            </Link>
            <Link
              href="/student/lessons"
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${pathname?.startsWith('/student/lessons') ? 'bg-brand-50 text-brand-600' : 'text-muted hover:bg-gray-50 hover:text-ink'}`}
            >
              Lessons
            </Link>
          </nav>
          <span className="text-xs text-muted hidden sm:block">{studentName}</span>
          <button onClick={handleSignOut} className="btn-ghost text-xs">
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>
      </div>
    </header>
  )
}
