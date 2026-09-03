'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import NotificationBell from './NotificationBell'
import type { EmailPrefs } from '@/lib/notificationPrefs'

/**
 * The student portal's header — Lesson Studio's StudentTopBar, plus the two
 * links this portal has (Dashboard, Lessons) and the email-preferences bell.
 */
export default function StudentTopBar({ studentName, emailPrefs }: { studentName: string; emailPrefs: EmailPrefs }) {
  const router = useRouter()
  const pathname = usePathname()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const onDash = pathname === '/student/dashboard'
  const onLessons = pathname?.startsWith('/student/lessons')

  return (
    <header className="k-bar">
      <div className="k-bar-brand">
        <span className="k-bar-mark" aria-hidden>
          <span style={{ fontSize: 15, fontWeight: 800, lineHeight: 1 }}>G</span>
        </span>
        <span className="k-bar-name">GENOA Library</span>
      </div>

      <nav className="k-bar-nav" aria-label="Student portal">
        <Link href="/student/dashboard" className={onDash ? 'on' : ''}>Dashboard</Link>
        <Link href="/student/lessons" className={onLessons ? 'on' : ''}>Lessons</Link>
      </nav>

      <div className="k-bar-tools">
        <span className="k-bar-who" title={studentName}>{studentName}</span>
        <NotificationBell initial={emailPrefs} />
        <button type="button" onClick={handleSignOut} className="k-bar-out">
          <svg className="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 17l5-5-5-5M20 12H9M12 4H5v16h7" />
          </svg>
          <span>Sign out</span>
        </button>
      </div>
    </header>
  )
}
