'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, ListChecks } from 'lucide-react'
import { submitExercise } from '@/app/actions/exercises'
import ExerciseAudioRecorder, { AudioSub } from './ExerciseAudioRecorder'

export interface Exercise {
  id: string
  type: 'read_aloud' | 'speak' | 'multiple_choice' | 'fill_blank'
  prompt: string
  data: any
  sort_order: number
}

export interface ExSubmission {
  exercise_id: string
  answer: any
  is_correct: boolean | null
}

export default function LessonExercises({
  lessonId,
  studentId,
  exercises,
  submissions,
  audioSubmissions = [],
}: {
  lessonId: string
  studentId: string
  exercises: Exercise[]
  submissions: ExSubmission[]
  audioSubmissions?: (AudioSub & { exercise_id: string })[]
}) {
  const router = useRouter()
  const subMap = new Map(submissions.map(s => [s.exercise_id, s]))
  const audioMap = new Map(audioSubmissions.map(a => [a.exercise_id, a]))

  const ordered = [...exercises].sort((a, b) => a.sort_order - b.sort_order)
  const speaking = ordered.filter(e => e.type === 'read_aloud' || e.type === 'speak')
  const graded   = ordered.filter(e => e.type === 'multiple_choice' || e.type === 'fill_blank')

  return (
    <div className="card p-6">
      <h2 className="section-title mb-4 flex items-center gap-2">
        <ListChecks className="w-4 h-4 text-brand-600" /> Practice Exercises
      </h2>

      {/* Speaking tasks (record using the recorder below) */}
      {speaking.length > 0 && (
        <div className="space-y-3 mb-5">
          {speaking.map((ex, i) => (
            <div key={ex.id} className="rounded-xl border border-indigo-50 bg-[#f8f7ff] p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wide text-brand-600 bg-white border border-indigo-100 rounded-full px-2 py-0.5">
                  🎙️ Speaking
                </span>
                <span className="text-sm font-bold text-ink">{ex.prompt}</span>
              </div>
              {ex.type === 'read_aloud' && (
                <>
                  {ex.data?.focus && <p className="text-xs text-muted mb-2">Focus: {ex.data.focus}</p>}
                  <div className="space-y-1.5">
                    {(ex.data?.sentences ?? []).map((s: any, j: number) => (
                      <div key={j} className="bg-white rounded-lg px-3 py-2 border border-gray-100">
                        <p className="text-base text-ink">{s.jp}</p>
                        {s.en && <p className="text-xs text-muted mt-0.5">{s.en}</p>}
                      </div>
                    ))}
                  </div>
                </>
              )}
              {ex.type === 'speak' && (
                <div className="bg-white rounded-lg px-3 py-2.5 border border-gray-100">
                  <p className="text-base text-ink">{ex.data?.prompt_jp}</p>
                  {ex.data?.prompt_en && <p className="text-xs text-muted mt-0.5">{ex.data.prompt_en}</p>}
                  {ex.data?.hint && <p className="text-[11px] text-brand-500 mt-1.5">💡 {ex.data.hint}</p>}
                </div>
              )}

              {/* This exercise's own recorder */}
              <ExerciseAudioRecorder
                lessonId={lessonId}
                studentId={studentId}
                exerciseId={ex.id}
                initial={audioMap.get(ex.id)}
              />
            </div>
          ))}
        </div>
      )}

      {/* Auto-graded exercises */}
      <div className="space-y-3">
        {graded.map(ex => (
          <GradedExercise
            key={ex.id}
            ex={ex}
            lessonId={lessonId}
            existing={subMap.get(ex.id)}
            onSaved={() => router.refresh()}
          />
        ))}
      </div>
    </div>
  )
}

function GradedExercise({
  ex, lessonId, existing, onSaved,
}: {
  ex: Exercise
  lessonId: string
  existing?: ExSubmission
  onSaved: () => void
}) {
  // Locked once answered (from a previous visit or this session)
  const [answered, setAnswered] = useState<{ value: any; correct: boolean } | null>(
    existing ? { value: existing.answer, correct: !!existing.is_correct } : null,
  )

  function lockIn(value: any, correct: boolean) {
    setAnswered({ value, correct })
    submitExercise({ exerciseId: ex.id, lessonId, answer: value, isCorrect: correct })
      .then(onSaved)
      .catch(() => {})
  }

  if (ex.type === 'multiple_choice') {
    const opts: string[] = ex.data?.options ?? []
    const correctIdx: number = ex.data?.answer ?? 0
    return (
      <div className="rounded-xl border border-gray-100 p-4">
        <p className="text-sm font-semibold text-ink mb-3">{ex.data?.question || ex.prompt}</p>
        <div className="flex flex-col gap-2">
          {opts.map((o, i) => {
            const chosen = answered?.value === i
            const isCorrect = i === correctIdx
            let cls = 'border-gray-200 bg-white hover:border-brand-200 hover:bg-brand-50'
            if (answered) {
              if (isCorrect) cls = 'border-green-300 bg-green-50 text-green-700 font-semibold'
              else if (chosen) cls = 'border-red-300 bg-red-50 text-red-700'
              else cls = 'border-gray-100 bg-white text-muted'
            }
            return (
              <button
                key={i}
                disabled={!!answered}
                onClick={() => lockIn(i, i === correctIdx)}
                className={`text-left rounded-lg border px-3.5 py-2.5 text-sm transition-colors flex items-center gap-2 ${cls}`}
              >
                <span className="flex-1">{o}</span>
                {answered && isCorrect && <CheckCircle2 className="w-4 h-4 text-green-600" />}
                {answered && chosen && !isCorrect && <span className="text-red-500 font-bold">✗</span>}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // fill_blank
  const opts: string[] = ex.data?.options ?? []
  const correctAns: string = ex.data?.answer ?? ''
  return (
    <div className="rounded-xl border border-gray-100 p-4">
      <p className="text-sm font-semibold text-ink mb-1">{ex.prompt}</p>
      <div className="bg-[#f8f7ff] rounded-lg px-3.5 py-3 my-2 text-base text-ink">
        {ex.data?.before}
        <span
          className={`inline-block min-w-[52px] text-center font-bold border-b-2 px-2 mx-0.5 ${
            answered ? (answered.correct ? 'text-green-600 border-green-500' : 'text-red-600 border-red-500') : 'text-brand-600 border-brand-400'
          }`}
        >
          {answered ? answered.value : '＿＿'}
        </span>
        {ex.data?.after}
      </div>
      {ex.data?.en && <p className="text-xs text-muted mb-2">{ex.data.en}</p>}
      <div className="flex flex-wrap gap-2">
        {opts.map((o, i) => (
          <button
            key={i}
            disabled={!!answered}
            onClick={() => lockIn(o, o === correctAns)}
            className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
              answered ? 'border-gray-100 bg-white text-muted opacity-60' : 'border-gray-200 bg-white hover:border-brand-200 hover:bg-brand-50'
            }`}
          >
            {o}
          </button>
        ))}
      </div>
      {answered && !answered.correct && (
        <p className="text-xs text-green-600 font-semibold mt-2.5">✓ Correct answer: {correctAns}</p>
      )}
    </div>
  )
}
