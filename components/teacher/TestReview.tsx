'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Loader2, Clock, FileText, Sparkles, Save } from 'lucide-react'
import { setTestStatus, deleteTest, deleteTestQuestion, gradeTestAnswer } from '@/app/actions/tests'
import type { TestQuestion, TestSubmission } from '@/lib/types'

const TYPE_LABEL: Record<string, string> = {
  written: '✍️ Written',
  speak: '🎙️ Speaking',
  read_aloud: '🎙️ Read aloud',
}

export default function TestReview({
  test,
  questions,
  submissions,
  submitted,
}: {
  test: { id: string; title: string; instructions?: string | null; status: string; duration_minutes: number; lesson_numbers: number[]; student_id: string }
  questions: TestQuestion[]
  submissions: TestSubmission[]
  submitted: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [published, setPublished] = useState(test.status === 'published')

  const subByQuestion = new Map(submissions.map(s => [s.question_id, s]))

  function togglePublish() {
    const next = !published
    setPublished(next)
    startTransition(async () => {
      await setTestStatus(test.id, next ? 'published' : 'draft')
      router.refresh()
    })
  }

  function handleDeleteQuestion(id: string) {
    if (!confirm('Remove this question from the test?')) return
    setBusyId(id)
    startTransition(async () => {
      await deleteTestQuestion(id)
      setBusyId(null)
      router.refresh()
    })
  }

  function handleDeleteTest() {
    if (!confirm('Delete this entire test? This cannot be undone.')) return
    startTransition(async () => {
      const res = await deleteTest(test.id)
      router.push(`/teacher/students/${res.studentId ?? test.student_id}`)
    })
  }

  const ordered = [...questions].sort((a, b) => a.sort_order - b.sort_order)

  return (
    <div className="space-y-6">
      {/* Header / controls */}
      <div className="card p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wide text-purple-600 bg-purple-50 border border-purple-100 rounded-full px-2 py-0.5 inline-flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> AI-built
              </span>
              <span className={`text-[10px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5 ${published ? 'text-green-600 bg-green-50 border border-green-100' : 'text-orange-600 bg-orange-50 border border-orange-100'}`}>
                {published ? 'Published' : 'Draft'}
              </span>
            </div>
            <h1 className="text-xl font-bold text-ink flex items-center gap-2">
              <FileText className="w-5 h-5 text-brand-600" /> {test.title}
            </h1>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted">
              <span className="inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {test.duration_minutes} min</span>
              {test.lesson_numbers?.length > 0 && <span>Covers lessons {test.lesson_numbers.join(', ')}</span>}
              <span>{ordered.length} questions</span>
            </div>
          </div>
          <button onClick={handleDeleteTest} disabled={pending} className="text-gray-400 hover:text-red-500 shrink-0" title="Delete test">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {test.instructions && <p className="text-sm text-muted mt-3 whitespace-pre-line">{test.instructions}</p>}

        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-gray-50 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-ink">{published ? 'Shared with student' : 'Not shared yet'}</p>
            <p className="text-xs text-muted">
              {published
                ? 'The student can see and take this test on their dashboard.'
                : 'Review the questions below, then publish to share it.'}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={published}
            onClick={togglePublish}
            disabled={pending}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${published ? 'bg-brand-600' : 'bg-gray-300'}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${published ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>

        {submitted && (
          <div className="mt-3 rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-2.5 text-sm font-semibold text-emerald-700">
            ✓ Student has submitted this test — grade their answers below.
          </div>
        )}
      </div>

      {/* Questions */}
      <div className="space-y-3">
        {ordered.map((q, i) => (
          <div key={q.id} className="card p-5">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-ink bg-gray-100 rounded-full w-6 h-6 inline-flex items-center justify-center">{i + 1}</span>
                <span className="text-[11px] font-bold text-brand-600 bg-brand-50 border border-indigo-100 rounded-full px-2.5 py-0.5">
                  {TYPE_LABEL[q.type] ?? q.type}
                </span>
                <span className="text-[11px] text-muted">{q.points} pt{q.points !== 1 ? 's' : ''}</span>
              </div>
              <button onClick={() => handleDeleteQuestion(q.id)} disabled={pending} className="text-gray-400 hover:text-red-500 shrink-0" title="Remove question">
                {busyId === q.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              </button>
            </div>

            <p className="text-sm font-semibold text-ink">{q.prompt}</p>
            <QuestionPreview q={q} />

            {/* Student's answer + grading */}
            <AnswerGrader submission={subByQuestion.get(q.id)} points={q.points} />
          </div>
        ))}
      </div>
    </div>
  )
}

function QuestionPreview({ q }: { q: TestQuestion }) {
  if (q.type === 'read_aloud') {
    return (
      <div className="mt-2">
        {q.data?.focus && <p className="text-xs text-muted mb-1.5">Focus: {q.data.focus}</p>}
        <ul className="space-y-1">
          {(q.data?.sentences ?? []).map((s: any, i: number) => (
            <li key={i} className="text-sm text-ink">{s.jp} <span className="text-muted text-xs">— {s.en}</span></li>
          ))}
        </ul>
      </div>
    )
  }
  if (q.type === 'speak') {
    return (
      <div className="mt-2">
        {q.data?.prompt_jp && <p className="text-sm text-ink">{q.data.prompt_jp}</p>}
        {q.data?.prompt_en && <p className="text-xs text-muted">{q.data.prompt_en}</p>}
        {q.data?.hint && <p className="text-[11px] text-brand-500 mt-1">💡 {q.data.hint}</p>}
      </div>
    )
  }
  // written
  return (
    <div className="mt-2 space-y-1">
      {q.data?.context && <p className="text-sm text-ink bg-[#f8f7ff] rounded-lg px-3 py-2">{q.data.context}</p>}
      {q.data?.reference_answer && (
        <p className="text-xs text-muted"><span className="font-semibold text-emerald-600">Model answer:</span> {q.data.reference_answer}</p>
      )}
      {q.data?.guidance && <p className="text-[11px] text-muted">Grading note: {q.data.guidance}</p>}
    </div>
  )
}

function AnswerGrader({ submission, points }: { submission?: TestSubmission; points: number }) {
  const [pending, startTransition] = useTransition()
  const [score, setScore] = useState<string>(submission?.score != null ? String(submission.score) : '')
  const [feedback, setFeedback] = useState(submission?.teacher_feedback ?? '')
  const [saved, setSaved] = useState(false)

  if (!submission) {
    return <p className="text-xs text-muted mt-3 italic">No answer submitted yet.</p>
  }

  function save() {
    setSaved(false)
    startTransition(async () => {
      await gradeTestAnswer({
        submissionId: submission!.id,
        score: score === '' ? null : Number(score),
        feedback,
      })
      setSaved(true)
    })
  }

  return (
    <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50/60 p-3.5 space-y-2.5">
      <p className="text-[10px] font-bold text-muted uppercase tracking-widest">Student answer</p>
      {submission.answer_text && <p className="text-sm text-ink whitespace-pre-line">{submission.answer_text}</p>}
      {submission.audio_url && <audio controls src={submission.audio_url} className="w-full h-9" />}
      {!submission.answer_text && !submission.audio_url && <p className="text-xs text-muted italic">Empty answer.</p>}

      <div className="flex items-center gap-2 pt-1">
        <input
          type="number"
          value={score}
          min={0}
          max={points}
          step="0.5"
          onChange={e => { setScore(e.target.value); setSaved(false) }}
          placeholder="—"
          className="w-16 rounded-lg border border-gray-200 px-2 py-1 text-sm text-center"
        />
        <span className="text-xs text-muted">/ {points}</span>
        <input
          type="text"
          value={feedback}
          onChange={e => { setFeedback(e.target.value); setSaved(false) }}
          placeholder="Feedback for the student…"
          className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm"
        />
        <button onClick={save} disabled={pending} className="btn-primary text-xs shrink-0 disabled:opacity-50">
          {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Save
        </button>
      </div>
      {saved && <p className="text-xs text-green-600 font-semibold">✓ Saved</p>}
    </div>
  )
}
