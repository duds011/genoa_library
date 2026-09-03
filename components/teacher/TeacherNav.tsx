'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type IconName = 'home' | 'users' | 'note' | 'wallet' | 'chart' | 'book' | 'import' | 'collapse' | 'menu' | 'close'

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, React.ReactNode> = {
    home: <><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-7h6v7"/></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    note: <><path d="M5 3h14v14l-4 4H5z"/><path d="M15 21v-4h4M9 8h6M9 12h4"/></>,
    wallet: <><path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2"/><path d="M21 12a2 2 0 0 0-2-2h-5a2 2 0 0 0 0 4h5a2 2 0 0 0 2-2Z"/></>,
    chart: <><path d="M3 3v18h18"/><path d="M7 15l4-5 4 3 5-7"/></>,
    book: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/></>,
    import: <><path d="M14 3v5h5M6 3h8l5 5v13H6z"/><path d="M12 11v6M9 14l3 3 3-3"/></>,
    collapse: <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/></>,
    menu: <><path d="M3 6h18M3 12h18M3 18h18"/></>,
    close: <><path d="M6 6l12 12M18 6 6 18"/></>,
  }
  return <svg className="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

export function LogoMark() {
  return <span className="mark" aria-hidden="true"><Icon name="book" /></span>
}

const LINKS: { href: string; label: string; icon: IconName }[] = [
  { href: '/teacher/dashboard', label: 'Overview', icon: 'home' },
  { href: '/teacher/students', label: 'Students', icon: 'users' },
  { href: '/teacher/notes', label: 'Notes', icon: 'note' },
  { href: '/teacher/payments', label: 'Payments', icon: 'wallet' },
  { href: '/teacher/analytics', label: 'Analytics', icon: 'chart' },
]

/** Remembered per browser, and read straight off the root element so the
 *  --sidebar width the whole layout is built on collapses with it. */
const NAV_KEY = 'nav-collapsed'

/**
 * The teacher's sidebar — Lesson Studio's AppNav, carried over whole. A
 * floating card on desktop that collapses to an icon rail, a slide-in drawer
 * behind a slim top bar on a phone: one navigation, two ways to summon it.
 */
export default function TeacherNav({ teacherName, email }: { teacherName: string; email?: string | null }) {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  useEffect(() => { setMobileOpen(false) }, [pathname])

  useEffect(() => {
    const saved = localStorage.getItem(NAV_KEY) === '1'
    setCollapsed(saved)
    document.documentElement.dataset.nav = saved ? 'collapsed' : ''
  }, [])

  const toggleNav = () => {
    setCollapsed((was) => {
      const next = !was
      localStorage.setItem(NAV_KEY, next ? '1' : '0')
      document.documentElement.dataset.nav = next ? 'collapsed' : ''
      return next
    })
  }

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const isActive = (href: string) => pathname.startsWith(href) || (href === '/teacher/students' && pathname.startsWith('/teacher/lessons'))
  const accountLabel = teacherName || email?.split('@')[0] || 'Teacher'

  return (
    <>
      <header className="mobile-topbar">
        <Link className="logo" href="/teacher/dashboard" aria-label="GENOA Library overview">
          <LogoMark />
          <span className="brand-word">GENOA Library</span>
        </Link>
        <button
          type="button"
          className="mobile-nav-btn"
          onClick={() => setMobileOpen((v) => !v)}
          aria-expanded={mobileOpen}
          aria-controls="teacher-nav"
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
        >
          <Icon name={mobileOpen ? 'close' : 'menu'} />
        </button>
      </header>
      {mobileOpen && <div className="mobile-nav-scrim" onClick={() => setMobileOpen(false)} aria-hidden />}

      <aside id="teacher-nav" className={`app-sidebar ${mobileOpen ? 'mobile-open' : ''}`} aria-label="Teacher workspace navigation">
        <div className="sidebar-top">
          <Link className="logo" href="/teacher/dashboard" aria-label="GENOA Library overview">
            <LogoMark />
            <span><span className="brand-word">GENOA Library</span><small>Teacher workspace</small></span>
          </Link>
          <button
            type="button"
            className="nav-toggle"
            onClick={toggleNav}
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
            title={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          >
            <Icon name="collapse" />
          </button>
        </div>

        <div className="sidebar-scroll">
          <div className="nav-section-label">Workspace</div>
          <nav className="side-nav">
            {LINKS.map((link) => (
              <Link key={link.href} href={link.href} className={`side-link ${isActive(link.href) ? 'active' : ''}`}>
                <Icon name={link.icon} /><span>{link.label}</span>
              </Link>
            ))}
          </nav>

          <div className="nav-section-label">Manage</div>
          <nav className="side-nav">
            <Link href="/teacher/import" className={`side-link ${pathname.startsWith('/teacher/import') ? 'active' : ''}`}>
              <Icon name="import" /><span>Import transcript</span>
            </Link>
          </nav>
        </div>

        <div className="sidebar-account">
          <span className="account-avatar">{accountLabel.charAt(0).toUpperCase()}</span>
          <span className="account-copy">
            <strong>{accountLabel}</strong>
            <small><span className="status-dot online" />Drive pipeline on</small>
          </span>
          <button type="button" onClick={handleSignOut} className="btn btn-danger-ghost btn-sm" title="Sign out" aria-label="Sign out" style={{ padding: '6px 8px' }}>
            Sign out
          </button>
        </div>
      </aside>
    </>
  )
}
