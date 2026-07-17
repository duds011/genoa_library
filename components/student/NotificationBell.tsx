'use client'

import { useEffect, useRef, useState } from 'react'
import { Bell, Loader2, Check } from 'lucide-react'
import { saveMyEmailPrefs } from '@/app/actions/notificationPrefs'
import { EMAIL_CATEGORIES, type EmailCategory, type EmailPrefs } from '@/lib/notificationPrefs'

export default function NotificationBell({ initial }: { initial: EmailPrefs }) {
  const [open, setOpen] = useState(false)
  const [enabled, setEnabled] = useState(initial.enabled)
  const [prefs, setPrefs] = useState<Partial<Record<EmailCategory, boolean>>>(initial.prefs)
  const [saving, setSaving] = useState(false)
  const [savedTick, setSavedTick] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  const catOn = (key: EmailCategory) => enabled && prefs[key] !== false

  // Persist a full snapshot on each change so the toggle is durable without a
  // separate save button.
  async function persist(nextEnabled: boolean, nextPrefs: Partial<Record<EmailCategory, boolean>>) {
    setSaving(true); setSavedTick(false)
    const res = await saveMyEmailPrefs({ enabled: nextEnabled, prefs: nextPrefs })
    setSaving(false)
    if (res.success) { setSavedTick(true); setTimeout(() => setSavedTick(false), 1500) }
  }

  function toggleMaster() {
    const next = !enabled
    setEnabled(next)
    persist(next, prefs)
  }

  function toggleCategory(key: EmailCategory) {
    // Flipping a category on while everything is off implicitly turns the master
    // back on — otherwise the toggle would look stuck.
    const currentlyOn = catOn(key)
    const nextPrefs = { ...prefs, [key]: currentlyOn ? false : true }
    const nextEnabled = enabled || !currentlyOn
    setPrefs(nextPrefs)
    setEnabled(nextEnabled)
    persist(nextEnabled, nextPrefs)
  }

  const anyOn = enabled && EMAIL_CATEGORIES.some(c => prefs[c.key] !== false)

  return (
    <div className="relative" ref={wrapRef}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Email notifications"
        aria-expanded={open}
        className="relative text-gray-500 hover:text-brand-600 p-1 -m-1"
      >
        <Bell className="w-5 h-5" strokeWidth={1.75} fill="none" />
        {!anyOn && (
          // A muted dot when everything is off, so the state is legible at a glance.
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-gray-400 border border-white" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-gray-100 bg-white shadow-xl z-50 p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-bold text-ink">Email notifications</p>
              <p className="text-xs text-muted mt-0.5">Choose what Noa emails you about.</p>
            </div>
            <span className="h-4 w-4 shrink-0">
              {saving ? <Loader2 className="w-4 h-4 animate-spin text-muted" /> : savedTick ? <Check className="w-4 h-4 text-green-600" /> : null}
            </span>
          </div>

          {/* Master switch */}
          <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-gray-50 px-3 py-2.5">
            <div>
              <p className="text-sm font-semibold text-ink">All emails</p>
              <p className="text-[11px] text-muted">{enabled ? 'You get the ones ticked below.' : 'Everything is turned off.'}</p>
            </div>
            <Toggle on={enabled} onClick={toggleMaster} label="All emails" />
          </div>

          {/* Per-category */}
          <div className={`mt-1 divide-y divide-gray-50 ${enabled ? '' : 'opacity-50'}`}>
            {EMAIL_CATEGORIES.map(cat => (
              <div key={cat.key} className="flex items-center justify-between gap-3 py-2.5">
                <div>
                  <p className="text-sm font-medium text-ink">{cat.label}</p>
                  <p className="text-[11px] text-muted leading-snug">{cat.description}</p>
                </div>
                <Toggle on={catOn(cat.key)} onClick={() => toggleCategory(cat.key)} label={cat.label} />
              </div>
            ))}
          </div>

          <p className="text-[11px] text-muted mt-2">Changes save automatically.</p>
        </div>
      )}
    </div>
  )
}

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${on ? 'bg-brand-600' : 'bg-gray-300'}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${on ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  )
}
