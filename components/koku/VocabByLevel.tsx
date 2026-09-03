'use client'

import { useState } from 'react'
import { levelColor, levelScale } from './VocabLevelBreakdown'

export type VocabWord = {
  word: string
  reading: string | null
  definition: string | null
  level: string | null
  firstLessonNumber: number | null
  firstDate: string | null
  lessonCount: number
}

/**
 * Vocabulary as a bar you can open.
 *
 * Listing every word made the Progress tab a wall of text that got scrolled
 * past — the useful question is "how much do I have, and at what level", and
 * only then "which words". So the bar answers the first, and a level opens to
 * answer the second.
 */
export default function VocabByLevel({ words }: { words: VocabWord[] }) {
  const [open, setOpen] = useState<string | null>(null)

  const distribution: Record<string, number> = {}
  for (const w of words) {
    if (!w.level) continue
    distribution[w.level] = (distribution[w.level] ?? 0) + 1
  }

  const levels = levelScale(distribution)
    .map((level) => ({ level, count: distribution[level] ?? 0 }))
    .filter((l) => l.count > 0)

  const total = levels.reduce((sum, l) => sum + l.count, 0)
  if (total === 0) return null

  const shown = open ? words.filter((w) => w.level === open) : []

  return (
    <div>
      <div className="k-vlv-bar" role="group" aria-label="Vocabulary by level">
        {levels.map((l) => (
          <button
            key={l.level}
            type="button"
            className={`k-vlv-seg ${open === l.level ? 'sel' : ''}`}
            style={{ width: `${(l.count / total) * 100}%`, background: levelColor(l.level) }}
            onClick={() => setOpen(open === l.level ? null : l.level)}
            aria-pressed={open === l.level}
            aria-label={`${l.level}: ${l.count} words`}
            title={`${l.level}: ${l.count} words`}
          />
        ))}
      </div>

      <div className="k-vlv-chips">
        {levels.map((l) => (
          <button
            key={l.level}
            type="button"
            className={`k-vlv-chip ${open === l.level ? 'sel' : ''}`}
            style={{ ['--lv' as any]: levelColor(l.level) }}
            onClick={() => setOpen(open === l.level ? null : l.level)}
            aria-pressed={open === l.level}
          >
            <i />{l.level} <b>{l.count}</b>
          </button>
        ))}
      </div>

      {!open && (
        <p className="k-vlv-hint">Tap a level to see those words and where you met them.</p>
      )}

      {open && (
        <div className="k-vocab-list" style={{ marginTop: 14 }}>
          {shown.map((v, i) => (
            <div className="k-vocab-row" key={`${v.word}-${i}`}>
              <div className="k-vocab-main">
                <span className="k-vocab-word">{v.word}</span>
                {v.reading && <span className="k-vocab-reading">{v.reading}</span>}
              </div>
              {v.definition && <p className="k-vocab-def">{v.definition}</p>}
              <p className="k-vocab-when">
                {v.firstLessonNumber != null ? `First seen in lesson ${v.firstLessonNumber}` : 'First seen'}
                {v.firstDate ? ` · ${v.firstDate}` : ''}
                {v.lessonCount > 1 ? ` · came back in ${v.lessonCount - 1} more lesson${v.lessonCount - 1 === 1 ? '' : 's'}` : ''}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
