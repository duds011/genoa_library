'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Loader2, X, Sparkles } from 'lucide-react'
import { buildTest, type TestScript } from '@/app/actions/tests'
import { formatDateShort } from '@/lib/utils'

interface LessonOption {
  id: string
  lesson_number: number
  title?: string | null
  lesson_date: string
}

const SCRIPT_OPTIONS: { value: TestScript; label: string; hint: string }[] = [
  { value: 'romaji',   label: 'Romaji',   hint: 'Latin letters only' },
  { value: 'hiragana', label: 'Hiragana', hint: 'Kana, no kanji' },
  { value: 'kanji',    label: 'Kanji + kana', hint: 'Kanji with readings' },
]

const SECTION_OPTIONS: { value: string; label: string }[] = [
  { value: 'speaking', label: '🎙️ Speaking' },
  { value: 'reading',  label: '📖 Reading & Writing' },
  { value: 'grammar',  label: '✏️ Grammar' },
]

export default function BuildTestButton({
  studentId,
  lessons,
}: {
  studentId: string
  lessons: LessonOption[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [script, setScript] = useState<TestScript>('hiragana')
  const [sections, setSections] = useState<Set<string>>(new Set(['speaking', 'reading', 'grammar']))
  const [building, setBuilding] = useState(false)
  const [error, setError] = useState('')

  function toggleSection(v: string) {
    setSections(prev => {
      const next = new Set(prev)
      next.has(v) ? next.delete(v) : next.add(v)
      return next
    })
  }

  const allSelected = lessons.length > 0 && selected.size === lessons.length

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(lessons.map(l => l.id)))
  }

  async function handleBuild() {
    if (selected.size === 0) { setError('Pick at least one lesson.'); return }
    if (sections.size === 0) { setError('Pick at least one part to include.'); return }
    setBuilding(true); setError('')
    const res = await buildTest({
      studentId,
      lessonIds: Array.from(selected),
      options: { script, sections: Array.from(sections) },
    })
    setBuilding(false)
    if (!res.success || !res.testId) {
      setError(res.error ?? 'Something went wrong building the test.')
      return
    }
    router.push(`/teacher/tests/${res.testId}`)
  }

  return (
    <>
      <button
        onClick={() => { setOpen(true); setError('') }}
        disabled={lessons.length === 0}
        className="btn-primary text-xs disabled:opacity-50"
        title={lessons.length === 0 ? 'This student has no published lessons yet' : 'Build an AI test'}
      >
        <FileText className="w-3.5 h-3.5" /> Build Test
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => !building && setOpen(false)}>
          <div className="card w-full max-w-md p-6 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-1">
              <h2 className="text-lg font-bold text-ink flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-brand-600" /> Build a Test
              </h2>
              <button onClick={() => !building && setOpen(false)} className="text-gray-400 hover:text-ink">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-muted mb-4">
              Customize the 45-minute test for this student, then pick the lessons it should cover.
              You review before it&apos;s shared.
            </p>

            {/* Script */}
            <div className="mb-4">
              <p className="text-xs font-bold text-ink uppercase tracking-wide mb-1.5">Japanese script</p>
              <div className="grid grid-cols-3 gap-2">
                {SCRIPT_OPTIONS.map(o => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setScript(o.value)}
                    className={`rounded-lg border px-2 py-2 text-center transition-colors ${
                      script === o.value ? 'border-brand-400 bg-brand-50' : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <span className={`block text-xs font-bold ${script === o.value ? 'text-brand-700' : 'text-ink'}`}>{o.label}</span>
                    <span className="block text-[10px] text-muted mt-0.5">{o.hint}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Parts */}
            <div className="mb-4">
              <p className="text-xs font-bold text-ink uppercase tracking-wide mb-1.5">Parts to include</p>
              <div className="flex flex-wrap gap-2">
                {SECTION_OPTIONS.map(o => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => toggleSection(o.value)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      sections.has(o.value) ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-gray-200 text-muted hover:bg-gray-50'
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-ink uppercase tracking-wide">Lessons to cover</p>
              <button
                onClick={toggleAll}
                className="text-xs font-semibold text-brand-600 hover:underline"
              >
                {allSelected ? 'Clear all' : 'Select all'}
              </button>
            </div>

            <div className="space-y-2 mb-4">
              {lessons.map(l => (
                <label
                  key={l.id}
                  className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${
                    selected.has(l.id) ? 'border-brand-300 bg-brand-50' : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(l.id)}
                    onChange={() => toggle(l.id)}
                    className="w-4 h-4 accent-brand-600"
                  />
                  <span className="flex-1">
                    <span className="text-sm font-semibold text-ink">
                      Lesson {l.lesson_number}{l.title ? ` — ${l.title}` : ''}
                    </span>
                    <span className="block text-xs text-muted">{formatDateShort(l.lesson_date)}</span>
                  </span>
                </label>
              ))}
            </div>

            {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

            <div className="flex items-center gap-2">
              <button onClick={handleBuild} disabled={building} className="btn-primary flex-1 justify-center disabled:opacity-50">
                {building ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {building ? 'Building test…' : `Build test (${selected.size})`}
              </button>
              <button onClick={() => setOpen(false)} disabled={building} className="btn-ghost text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
