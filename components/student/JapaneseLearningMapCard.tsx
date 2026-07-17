'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { LearningMapCategory } from '@/lib/japaneseLearningMap'
import { learningMapTotals } from '@/lib/japaneseLearningMap'

type Props = {
  categories: LearningMapCategory[]
}

export default function JapaneseLearningMapCard({ categories }: Props) {
  const [selected, setSelected] = useState<LearningMapCategory | null>(null)
  const totals = useMemo(() => learningMapTotals(categories), [categories])
  const maxItems = Math.max(...categories.map(category => category.items.length), 1)

  if (!categories.length) return null

  return (
    <>
      <section className="card overflow-hidden" style={{ border: '1px solid rgba(79,70,229,0.10)' }}>
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-3 py-2">
          <div>
            <p className="text-[10px] font-medium text-muted uppercase tracking-widest">
              Japanese Learning Map
            </p>
            <h2 className="font-medium text-ink text-sm leading-tight">
              Grammar by category
            </h2>
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm font-medium text-brand-700 leading-none">{totals.itemCount}</p>
            <p className="text-[9px] text-muted font-medium uppercase tracking-wide">items</p>
          </div>
        </div>

        <div className="divide-y divide-gray-100">
          <div className="grid grid-cols-[minmax(82px,1.15fr)_minmax(82px,2fr)_34px] gap-2 px-3 py-1.5 text-[9px] font-medium uppercase tracking-widest text-muted">
            <span>Name</span>
            <span>Progress</span>
            <span className="text-right">No.</span>
          </div>
          {categories.map(category => {
            const pct = Math.max(8, Math.round((category.items.length / maxItems) * 100))

            return (
              <button
                key={category.id}
                type="button"
                onClick={() => setSelected(category)}
                className="grid w-full grid-cols-[minmax(82px,1.15fr)_minmax(82px,2fr)_34px] items-center gap-2 px-3 py-1.5 text-left hover:bg-brand-50/60 transition-colors focus:outline-none focus:bg-brand-50"
              >
                <span className="text-xs font-normal text-ink truncate">{category.title}</span>
                <span className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#4f46e5,#7c3aed)' }}
                  />
                </span>
                <span className="text-right text-xs font-medium text-brand-700">{category.items.length}</span>
              </button>
            )
          })}
        </div>
      </section>

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6"
          role="dialog"
          aria-modal="true"
          aria-label={`${selected.title} learning items`}
          onClick={() => setSelected(null)}
        >
          <div
            className="card w-full max-w-2xl max-h-[82vh] overflow-hidden"
            onClick={event => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-4 py-3">
              <div>
                <p className="text-[10px] font-medium text-muted uppercase tracking-widest mb-1">
                  {selected.items.length} items
                </p>
                <h3 className="font-medium text-ink text-base">{selected.title}</h3>
                <p className="text-sm text-muted mt-1">{selected.description}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-muted hover:bg-gray-50"
              >
                Close
              </button>
            </div>

            <div className="max-h-[62vh] overflow-y-auto p-4 space-y-1.5">
              {selected.items.map(item => (
                <div key={item.label} className="rounded-lg bg-[#fbfaff] border border-indigo-50 p-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                    <div>
                      <p className="font-medium text-brand-800 text-sm">{item.label}</p>
                      <p className="text-xs text-brand-600 italic mt-0.5">{item.reading}</p>
                      <p className="text-xs text-muted mt-1">{item.description}</p>
                    </div>

                    <div className="flex flex-wrap gap-1.5 sm:justify-end">
                      {item.lessons.map(lesson => (
                        <Link
                          key={`${item.label}-${lesson.id}`}
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
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
