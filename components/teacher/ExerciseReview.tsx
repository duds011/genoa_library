'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ListChecks, Trash2, Loader2, CheckCircle2 } from 'lucide-react'
import { deleteExercise, setExercisesVisibility } from '@/app/actions/exercises'

interface Exercise {
  id: string
  type: 'read_aloud' | 'speak' | 'multiple_choice' | 'fill_blank'
  prompt: string
  data: any
  sort_order: number
}

interface ExSubmission {
  exercise_id: string
  answer: any
  is_correct: boolean | null
}

const TYPE_LABEL: Record<string, string> = {
  read_aloud: '🎙️ Read aloud',
  speak: '🎙️ Speaking',
  multiple_choice: '✅ Multiple choice',
  fill_blank: '✏️ Fill in the blank',
}

export default function ExerciseReview({
  lessonId,
  exercises,
  submissions = [],
  initialShow = true,
}: {
  lessonId: string
  exercises: Exercise[]
  submissions?: ExSubmission[]
  initialShow?: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [show, setShow] = useState(initialShow)

  function toggleShow() {
    const next = !show
    setShow(next)
    startTransition(async () => {
      await setExercisesVisibility(lessonId, next)
      router.refresh()
    })
  }

  const ordered = [...exercises].sort((a, b) => a.sort_order - b.sort_order)
  const subMap = new Map(submissions.map(s => [s.exercise_id, s]))
  const gradedTotal = ordered.filter(e => e.type === 'multiple_choice' || e.type === 'fill_blank').length
  const answered = submissions.length
  const correct = submissions.filter(s => s.is_correct).length

  function handleDelete(id: string) {
    if (!confirm('Remove this exercise from the lesson?')) return
    setBusyId(id)
    startTransition(async () => {
      await deleteExercise(id)
      setBusyId(null)
      router.refresh()
    })
  }

  return (
    <div className="card p-4 sm:p-6">
      {/* Title and toggle sit side by side when there's room and stack on a
          phone — together they were 26px wider than the screen. */}
      <div className="flex items-center justify-between gap-3 mb-1 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <ListChecks className="w-4 h-4 text-brand-600 shrink-0" />
          <h2 className="section-title">Practice Exercises</h2>
          <span className="text-[10px] font-bold uppercase tracking-wide text-purple-600 bg-purple-50 border border-purple-100 rounded-full px-2 py-0.5">auto-generated</span>
        </div>
        {/* Show / hide to student */}
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs font-semibold ${show ? 'text-brand-600' : 'text-muted'}`}>
            {show ? 'Shown to student' : 'Hidden'}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={show}
            onClick={toggleShow}
            disabled={pending}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${show ? 'bg-brand-600' : 'bg-gray-300'}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${show ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>
      </div>
      <p className="text-xs text-muted mb-4">
        Review these before publishing. {show
          ? 'Students see them in their Homework tab; multiple-choice and fill-in are graded automatically.'
          : 'Currently hidden — students will not see the practice exercises for this lesson.'}
      </p>

      {answered > 0 && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3 mb-4 text-sm">
          <span className="font-bold text-emerald-700">Student's results: {correct}/{gradedTotal} correct</span>
          <span className="text-emerald-600"> · {answered} answered</span>
        </div>
      )}

      {ordered.length === 0 ? (
        <p className="text-sm text-muted text-center py-6">No exercises were generated for this lesson.</p>
      ) : (
        <div className="space-y-3">
          {ordered.map(ex => (
            <div key={ex.id} className="rounded-xl border border-gray-100 p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <span className="text-[11px] font-bold text-brand-600 bg-brand-50 border border-indigo-100 rounded-full px-2.5 py-0.5">
                  {TYPE_LABEL[ex.type] ?? ex.type}
                </span>
                <button
                  onClick={() => handleDelete(ex.id)}
                  disabled={pending}
                  title="Remove exercise"
                  className="text-gray-400 hover:text-red-500 transition-colors shrink-0"
                >
                  {busyId === ex.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </button>
              </div>

              {/* Type-specific preview */}
              {ex.type === 'read_aloud' && (
                <div>
                  {ex.data?.focus && <p className="text-xs text-muted mb-1.5">Focus: {ex.data.focus}</p>}
                  <ul className="space-y-1">
                    {(ex.data?.sentences ?? []).map((s: any, i: number) => (
                      <li key={i} className="text-sm text-ink">{s.jp} <span className="text-muted text-xs">— {s.en}</span></li>
                    ))}
                  </ul>
                </div>
              )}

              {ex.type === 'speak' && (
                <div>
                  <p className="text-sm text-ink">{ex.data?.prompt_jp}</p>
                  <p className="text-xs text-muted">{ex.data?.prompt_en}</p>
                  {ex.data?.hint && <p className="text-[11px] text-brand-500 mt-1">💡 {ex.data.hint}</p>}
                </div>
              )}

              {ex.type === 'multiple_choice' && (
                <div>
                  <p className="text-sm font-medium text-ink mb-1.5">{ex.data?.question}</p>
                  <ul className="space-y-1">
                    {(ex.data?.options ?? []).map((o: string, i: number) => (
                      <li key={i} className={`text-sm flex items-center gap-1.5 ${i === ex.data?.answer ? 'text-green-700 font-semibold' : 'text-muted'}`}>
                        {i === ex.data?.answer ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> : <span className="w-3.5 h-3.5 inline-block rounded-full border border-gray-300" />}
                        {o}
                      </li>
                    ))}
                  </ul>
                  {(() => {
                    const sub = subMap.get(ex.id)
                    if (!sub) return null
                    const opt = (ex.data?.options ?? [])[sub.answer]
                    return (
                      <p className={`text-xs font-semibold mt-2 ${sub.is_correct ? 'text-green-600' : 'text-red-600'}`}>
                        Student chose: {opt ?? String(sub.answer)} {sub.is_correct ? '✓' : '✗'}
                      </p>
                    )
                  })()}
                </div>
              )}

              {ex.type === 'fill_blank' && (
                <div>
                  <p className="text-sm text-ink">
                    {ex.data?.before}<span className="font-bold text-green-700"> {ex.data?.answer} </span>{ex.data?.after}
                  </p>
                  {ex.data?.en && <p className="text-xs text-muted mt-0.5">{ex.data.en}</p>}
                  <p className="text-[11px] text-muted mt-1">Options: {(ex.data?.options ?? []).join(' · ')}</p>
                  {(() => {
                    const sub = subMap.get(ex.id)
                    if (!sub) return null
                    return (
                      <p className={`text-xs font-semibold mt-1.5 ${sub.is_correct ? 'text-green-600' : 'text-red-600'}`}>
                        Student answered: {String(sub.answer)} {sub.is_correct ? '✓' : '✗'}
                      </p>
                    )
                  })()}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
