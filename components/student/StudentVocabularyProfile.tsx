'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'
import { JLPT_LEVELS } from '@/lib/jlpt'

export type StudentVocabularyItem = {
  id: string
  word: string
  reading?: string | null
  definition?: string | null
  example_sentence?: string | null
  jlpt_level: string
  lessons: Array<{
    id: string
    number: number
    title: string
  }>
}

type Props = {
  distribution: Record<string, number>
  totalCount: number
  vocab: StudentVocabularyItem[]
}

export default function StudentVocabularyProfile({ distribution, totalCount, vocab }: Props) {
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null)
  const counts = JLPT_LEVELS.map(level => ({
    ...level,
    count: distribution[level.level] ?? 0,
    savedCount: vocab.filter(item => item.jlpt_level === level.level).length,
  })).filter(level => level.count > 0 || level.savedCount > 0)

  const chartTotal = counts.reduce((sum, level) => sum + (level.count || level.savedCount), 0)
  const selected = counts.find(level => level.level === selectedLevel) ?? null
  const selectedWords = useMemo(() => {
    if (!selectedLevel) return []
    return vocab
      .filter(item => item.jlpt_level === selectedLevel)
      .sort((a, b) => a.word.localeCompare(b.word))
  }, [selectedLevel, vocab])

  useEffect(() => {
    if (!selectedLevel) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedLevel(null)
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [selectedLevel])

  if (!counts.length) return null

  return (
    <>
      <section className="card p-4" data-tour="vocab">
        <div className="flex items-center justify-between gap-3 mb-2">
          <h2 className="text-[11px] font-bold text-muted uppercase tracking-widest">
            Vocabulary Profile
          </h2>
          <span className="text-xs text-muted font-medium">{totalCount} vocabulary items covered</span>
        </div>

        <div className="flex rounded-xl overflow-hidden mb-2 h-[22px]">
          {counts.map(level => {
            const count = level.count || level.savedCount
            return (
              <button
                key={level.level}
                type="button"
                onClick={() => setSelectedLevel(level.level)}
                className="flex items-center justify-center text-[11px] font-bold overflow-hidden hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                style={{
                  width: `${(count / chartTotal) * 100}%`,
                  background: level.bar,
                  color: level.barText,
                  minWidth: 0,
                  padding: '0 0.35rem',
                  whiteSpace: 'nowrap',
                }}
                aria-label={`Open ${level.label} vocabulary`}
              >
                {(count / chartTotal) * 100 >= 9 ? count : ''}
              </button>
            )
          })}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {counts.map(level => (
            <button
              key={level.level}
              type="button"
              onClick={() => setSelectedLevel(level.level)}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1"
              style={{ background: level.badge, color: level.badgeText }}
            >
              <strong>{level.count || level.savedCount}</strong>
              <span className="font-normal opacity-75">{level.label}</span>
            </button>
          ))}
        </div>
      </section>

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="vocabulary-dialog-title"
          onMouseDown={event => {
            if (event.target === event.currentTarget) setSelectedLevel(null)
          }}
        >
          <div className="card w-full max-w-2xl max-h-[82vh] overflow-hidden">
            <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-4 py-3">
              <div>
                <p className="text-[10px] font-medium text-muted uppercase tracking-widest mb-1">
                  {selectedWords.length} saved {selectedWords.length === 1 ? 'word' : 'words'}
                </p>
                <h3 id="vocabulary-dialog-title" className="font-medium text-ink text-base">
                  {selected.label} vocabulary
                </h3>
                <p className="text-sm text-muted mt-1">
                  Select a lesson to review where the word was covered.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLevel(null)}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gray-200 text-muted hover:bg-gray-50"
                aria-label="Close vocabulary list"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[62vh] overflow-y-auto p-4 space-y-1.5">
              {selectedWords.length > 0 ? selectedWords.map(item => (
                <article key={item.id} className="rounded-lg bg-[#fbfaff] border border-indigo-50 p-2.5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-medium text-brand-800 text-sm">{item.word}</p>
                      <p className="text-xs text-brand-600 italic mt-0.5">
                        Romaji: {item.reading || 'not saved yet'}
                      </p>
                      {item.definition && <p className="text-xs text-muted mt-1">{item.definition}</p>}
                      {item.example_sentence && (
                        <p className="text-xs text-ink/70 mt-1 border-l-2 border-brand-100 pl-2">
                          {item.example_sentence}
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 flex-wrap gap-1.5 sm:max-w-[42%] sm:justify-end">
                      {item.lessons.map(lesson => (
                        <Link
                          key={lesson.id}
                          href={`/student/lessons/${lesson.id}`}
                          className="inline-flex items-center rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-brand-700 border border-indigo-100 hover:bg-indigo-50"
                          title={lesson.title}
                        >
                          Lesson {lesson.number}
                        </Link>
                      ))}
                    </div>
                  </div>
                </article>
              )) : (
                <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                  <p className="text-sm text-muted">
                    This level is included in the lesson analysis, but its individual word cards have not been saved yet.
                  </p>
                </div>
              )}

              {selected.count > selectedWords.length && selectedWords.length > 0 && (
                <p className="px-1 pt-2 text-xs text-muted">
                  The profile counted {selected.count} mentions. This list shows the {selectedWords.length} individual words saved in your lessons.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
