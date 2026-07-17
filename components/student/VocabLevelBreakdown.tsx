'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'

const JLPT_LEVELS = [
  { level: 'N5', label: 'N5', bar: '#4ade80', barText: '#14532d', badge: '#dcfce7', badgeText: '#166534' },
  { level: 'N4', label: 'N4', bar: '#22d3ee', barText: '#164e63', badge: '#cffafe', badgeText: '#155e75' },
  { level: 'N3', label: 'N3', bar: '#60a5fa', barText: '#1e3a8a', badge: '#dbeafe', badgeText: '#1e40af' },
  { level: 'N2', label: 'N2', bar: '#a78bfa', barText: '#3b0764', badge: '#ede9fe', badgeText: '#5b21b6' },
  { level: 'N1', label: 'N1', bar: '#f87171', barText: '#7f1d1d', badge: '#fee2e2', badgeText: '#991b1b' },
]

export const JLPT_COLORS: Record<string, string> = Object.fromEntries(
  JLPT_LEVELS.map(({ level, bar }) => [level, bar])
)

export const JLPT_LABELS: Record<string, string> = Object.fromEntries(
  JLPT_LEVELS.map(({ level, label }) => [level, label])
)

interface Props {
  vocab?: VocabItem[]
  distribution?: Record<string, number> | null
  totalCount?: number | null
  isPartial?: boolean
}

type VocabItem = {
  id?: string
  word?: string | null
  reading?: string | null
  definition?: string | null
  example_sentence?: string | null
  jlpt_level?: string | null
  lessons?: Array<{
    id: string
    number: number
    title: string
  }>
}

export default function VocabLevelBreakdown({
  vocab = [],
  distribution,
  totalCount,
  isPartial = false,
}: Props) {
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null)
  const counts = JLPT_LEVELS.map(def => ({
    ...def,
    count: distribution
      ? (distribution[def.level] ?? 0)
      : vocab.filter(v => v.jlpt_level === def.level).length,
  })).filter(c => c.count > 0)
  const selectedMeta = counts.find(count => count.level === selectedLevel)
  const selectedWords = useMemo(() => {
    if (!selectedLevel) return []
    return vocab
      .filter(item => item.jlpt_level === selectedLevel && item.word)
      .sort((a, b) => String(a.word).localeCompare(String(b.word)))
  }, [selectedLevel, vocab])

  const labeled = counts.reduce((sum, c) => sum + c.count, 0)
  const displayTotal = totalCount ?? (distribution ? labeled : vocab.length)

  if (labeled === 0) {
    return (
      <div className="card p-4">
        <h2 className="text-[11px] font-bold text-muted uppercase tracking-widest mb-1.5">
          Vocabulary Profile
        </h2>
        <p className="text-sm text-muted">No vocabulary items detected for this lesson.</p>
      </div>
    )
  }

  return (
    <>
    <div className="card p-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-[11px] font-bold text-muted uppercase tracking-widest">
          Vocabulary Profile
        </h2>
        <span className="text-xs text-muted font-medium">
          {displayTotal}{isPartial ? '+' : ''} vocabulary items covered
        </span>
      </div>

      {/* Segmented bar */}
      <div className="flex rounded-xl overflow-hidden mb-2" style={{ height: '22px' }}>
        {counts.map(({ level, bar, barText, count }) => (
          <button
            key={level}
            type="button"
            onClick={() => setSelectedLevel(level)}
            className="flex items-center justify-center text-[11px] font-bold transition-all overflow-hidden hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1"
            style={{
              width: `${(count / labeled) * 100}%`,
              background: bar,
              color: barText,
              minWidth: 0,
              padding: '0 0.35rem',
              whiteSpace: 'nowrap',
            }}
          >
            {(count / labeled) * 100 >= 9 ? `${count}` : ''}
          </button>
        ))}
      </div>

      {/* Badge legend */}
      <div className="flex flex-wrap gap-1.5">
        {counts.map(({ level, label, badge, badgeText, count }) => (
          <button
            key={level}
            type="button"
            onClick={() => setSelectedLevel(level)}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1"
            style={{ background: badge, color: badgeText }}
          >
            <strong>{count}</strong>
            <span className="font-normal opacity-75">{label}</span>
          </button>
        ))}
      </div>
    </div>

    {selectedMeta && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6"
        role="dialog"
        aria-modal="true"
        aria-label={`${selectedMeta.label} vocabulary words`}
        onClick={() => setSelectedLevel(null)}
      >
        <div
          className="card w-full max-w-2xl max-h-[82vh] overflow-hidden"
          onClick={event => event.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-4 py-3">
            <div>
              <p className="text-[10px] font-medium text-muted uppercase tracking-widest mb-1">
                {selectedMeta.count}{isPartial ? '+' : ''} items
              </p>
              <h3 className="font-medium text-ink text-base">{selectedMeta.label} vocabulary</h3>
              <p className="text-sm text-muted mt-1">
                Words saved from your lessons. Tap a lesson to review where it appeared.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedLevel(null)}
              className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-muted hover:bg-gray-50"
            >
              Close
            </button>
          </div>

          <div className="max-h-[62vh] overflow-y-auto p-4 space-y-1.5">
            {selectedWords.length > 0 ? selectedWords.map(item => (
              <div key={`${item.word}-${item.reading}-${item.jlpt_level}`} className="rounded-lg bg-[#fbfaff] border border-indigo-50 p-2.5">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                  <div>
                    <p className="font-medium text-brand-800 text-sm">{item.word}</p>
                    {item.reading && <p className="text-xs text-brand-600 italic mt-0.5">{item.reading}</p>}
                    {item.definition && <p className="text-xs text-muted mt-1">{item.definition}</p>}
                    {item.example_sentence && <p className="text-xs text-ink/70 mt-1">{item.example_sentence}</p>}
                  </div>

                  <div className="flex flex-wrap gap-1.5 sm:justify-end">
                    {(item.lessons || []).map(lesson => (
                      <Link
                        key={`${item.word}-${lesson.id}`}
                        href={`/student/lessons/${lesson.id}`}
                        className="inline-flex items-center rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-brand-700 border border-indigo-100 hover:bg-indigo-50 transition-colors"
                        title={lesson.title}
                      >
                        Lesson {lesson.number}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            )) : (
              <div className="rounded-lg bg-gray-50 border border-gray-100 p-4">
                <p className="text-sm text-muted">
                  This level has a summary count, but no individual saved word rows yet.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    )}
    </>
  )
}
