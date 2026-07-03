'use client'

import { useState, useEffect, useRef, type ReactNode } from 'react'

export interface RecapTab {
  id: string
  label: string
  icon?: string
  content: ReactNode
}

export default function LessonTabs({ tabs }: { tabs: RecapTab[] }) {
  const [active, setActive] = useState(tabs[0]?.id)
  const panelRefs = useRef<Record<string, HTMLDivElement | null>>({})

  // Replay the entrance animation on the newly-active panel (without remounting it,
  // so in-progress recordings / answers are preserved).
  useEffect(() => {
    const el = panelRefs.current[active as string]
    if (!el) return
    el.classList.remove('tab-anim')
    void el.offsetWidth // force reflow so the animation restarts
    el.classList.add('tab-anim')
  }, [active])

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto -mx-1 px-1"
        style={{ scrollbarWidth: 'none' }}>
        {tabs.map(t => {
          const on = active === t.id
          return (
            <button
              key={t.id}
              onClick={() => setActive(t.id)}
              className={`shrink-0 px-4 py-3 text-sm font-semibold flex items-center gap-1.5 whitespace-nowrap border-b-2 -mb-px transition-colors ${
                on ? 'border-brand-600 text-brand-600' : 'border-transparent text-muted hover:text-ink'
              }`}
            >
              {t.icon && <span className="text-base leading-none">{t.icon}</span>}
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Panels — all kept mounted, inactive ones hidden so client state persists */}
      {tabs.map(t => (
        <div
          key={t.id}
          ref={el => { panelRefs.current[t.id] = el }}
          className={active === t.id ? 'space-y-5 pt-5 tab-anim' : 'hidden'}
        >
          {t.content}
        </div>
      ))}
    </div>
  )
}
