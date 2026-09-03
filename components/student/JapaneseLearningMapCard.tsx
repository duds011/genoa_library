'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { LearningMapCategory } from '@/lib/japaneseLearningMap'
import { learningMapTotals } from '@/lib/japaneseLearningMap'

type Props = {
  categories: LearningMapCategory[]
}

/**
 * The grammar a student has actually met, by category.
 *
 * Built from their own lesson sections rather than a syllabus, so a category
 * with nine items means nine things they have been taught. Tapping one opens
 * what those were and which lesson each came from.
 *
 * Dressed in the portal's own card chrome — the heading, the label sizes and
 * the row rules are the ones every other block uses, so this reads as part of
 * the page rather than a table someone pasted into it.
 */
export default function JapaneseLearningMapCard({ categories }: Props) {
  const [selected, setSelected] = useState<LearningMapCategory | null>(null)
  const totals = useMemo(() => learningMapTotals(categories), [categories])
  const maxItems = Math.max(...categories.map(category => category.items.length), 1)

  if (!categories.length) return null

  return (
    <>
      <div className="k-sec-head" style={{ margin: '4px 0 12px' }}>
        <h2>Grammar you have met</h2>
        <span className="k-link">{totals.itemCount} points</span>
      </div>

      <div className="k-card" data-tour="learning-map">
        <div className="k-gmap-head">
          <span>Category</span>
          <span>How much</span>
          <span style={{ textAlign: 'right' }}>Points</span>
        </div>

        {categories.map(category => {
          const pct = Math.max(8, Math.round((category.items.length / maxItems) * 100))
          return (
            <button
              key={category.id}
              type="button"
              onClick={() => setSelected(category)}
              className="k-gmap-row"
            >
              <span className="k-gmap-name">{category.title}</span>
              <span className="k-gmap-track">
                <i style={{ width: `${pct}%` }} />
              </span>
              <b>{category.items.length}</b>
            </button>
          )
        })}
      </div>

      {selected && (
        <div className="modal-scrim" role="dialog" aria-modal="true"
             aria-label={`${selected.title} grammar points`} onClick={() => setSelected(null)}>
          <div className="modal-card" onClick={event => event.stopPropagation()}>
            <div className="g-modal-head">
              <div>
                <span className="k-phead-eyebrow" style={{ color: 'var(--muted)' }}>
                  {selected.items.length} {selected.items.length === 1 ? 'point' : 'points'}
                </span>
                <h3>{selected.title}</h3>
                <p>{selected.description}</p>
              </div>
              <button type="button" className="close-btn" onClick={() => setSelected(null)} aria-label="Close">✕</button>
            </div>

            <div className="g-modal-body">
              <div className="k-vocab-list">
                {selected.items.map(item => (
                  <div key={item.label} className="k-vocab-row">
                    <div className="k-vocab-main">
                      <span className="k-vocab-word">{item.label}</span>
                      {item.reading && <span className="k-vocab-reading">{item.reading}</span>}
                      <span style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {item.lessons.map(lesson => (
                          <Link
                            key={`${item.label}-${lesson.id}`}
                            href={`/student/lessons/${lesson.id}`}
                            className="k-vocab-level"
                            title={lesson.title}
                          >
                            Lesson {lesson.number}
                          </Link>
                        ))}
                      </span>
                    </div>
                    {item.description && <p className="k-vocab-def">{item.description}</p>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
