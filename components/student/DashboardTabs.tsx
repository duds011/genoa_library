'use client'

import { useState } from 'react'

export type DashboardTab = { id: string; label: string; content: React.ReactNode }

/**
 * The student dashboard, one tab at a time — Lesson Studio's DashboardTabs.
 * Panels other than the active one are unmounted: a Recharts container
 * inside a hidden element measures zero and draws an axis with nothing on
 * it, so every chart mounts only when its tab is showing.
 */
export default function DashboardTabs({ tabs }: { tabs: DashboardTab[] }) {
  const [active, setActive] = useState(tabs[0]?.id)
  if (tabs.length === 0) return null
  const current = tabs.find((t) => t.id === active) ?? tabs[0]

  return (
    <>
      <div className="k-dtabs" role="tablist" aria-label="Dashboard sections">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active === t.id}
            className={active === t.id ? 'on' : ''}
            onClick={() => setActive(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div key={current.id} className="k-flow page-fade" role="tabpanel" aria-label={current.label}>
        {current.content}
      </div>
    </>
  )
}
