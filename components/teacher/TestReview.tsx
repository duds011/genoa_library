'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Loader2, Clock, FileText, Sparkles, Save, CheckCircle2, Pencil } from 'lucide-react'
import { setTestStatus, deleteTest, deleteTestQuestion, gradeTestAnswer, updateTest } from '@/app/actions/tests'
import type { TestQuestion, TestSubmission } from '@/lib/types'
import { groupBySection } from '@/lib/utils'
import QuestionEditor from './QuestionEditor'

const TYPE_LABEL: Record<string, string> = {
  written: '✍️ Written',
  speak: '🎙️ Speaking',
  read_aloud: '🎙️ Read aloud',
  reading_passage: '📖 Reading',
  multiple_choice: '✅ Multiple choice',
  fill_blank: '✏️ Fill in the blank',
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
  const [editingId, setEditingId] = useState<string | null>(null)
  const [published, setPublished] = useState(test.status === 'published')

  // Editable test details (title / instructions / duration)
  const [editingDetails, setEditingDetails] = useState(false)
  const [title, setTitle] = useState(test.title)
  const [instructions, setInstructions] = useState(test.instructions ?? '')
  const [duration, setDuration] = useState<number>(test.duration_minutes)
  const [savingDetails, setSavingDetails] = useState(false)

  async function saveDetails() {
    setSavingDetails(true)
    await updateTest({ testId: test.id, title, instructions, duration_minutes: duration })
    setSavingDetails(false)
    setEditingDetails(false)
    router.refresh()
  }

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
              <FileText className="w-5 h-5 text-brand-600" /> {title}
            </h1>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted">
              <span className="inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {duration} min</span>
              {test.lesson_numbers?.length > 0 && <span>Covers lessons {test.lesson_numbers.join(', ')}</span>}
              <span>{ordered.length} questions</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => setEditingDetails(v => !v)} className="text-gray-400 hover:text-brand-600" title="Edit test details">
              <Pencil className="w-4 h-4" />
            </button>
            <button onClick={handleDeleteTest} disabled={pending} className="text-gray-400 hover:text-red-500" title="Delete test">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {editingDetails ? (
          <div className="mt-3 space-y-2 rounded-xl border border-gray-100 p-3">
            <label className="block">
              <span className="text-[11px] font-semibold text-muted uppercase tracking-wide">Title</span>
              <input value={title} onChange={e => setTitle(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none" />
            </label>
            <label className="block">
              <span className="text-[11px] font-semibold text-muted uppercase tracking-wide">Instructions</span>
              <textarea value={instructions} onChange={e => setInstructions(e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none" />
            </label>
            <label className="block">
              <span className="text-[11px] font-semibold text-muted uppercase tracking-wide">Duration (minutes)</span>
              <input type="number" min={1} value={duration} onChange={e => setDuration(Number(e.target.value))} className="mt-1 w-28 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none" />
            </label>
            <div className="flex items-center gap-2 pt-1">
              <button onClick={saveDetails} disabled={savingDetails} className="btn-primary text-xs disabled:opacity-50">
                {savingDetails ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save
              </button>
              <button onClick={() => setEditingDetails(false)} disabled={savingDetails} className="btn-ghost text-xs">Cancel</button>
            </div>
          </div>
        ) : (
          instructions && <p className="text-sm text-muted mt-3 whitespace-pre-line">{instructions}</p>
        )}

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

      {/* Questions grouped by part */}
      {(() => {
        let n = 0
        return groupBySection(ordered).map(section => (
          <div key={section.key} className="space-y-3">
            <div className="flex items-center gap-2 pt-1">
              {section.part && <span className="text-[11px] font-bold uppercase tracking-wide text-white bg-brand-600 rounded-full px-2.5 py-0.5">{section.part}</span>}
              <h2 className="section-title">{section.title}</h2>
            </div>
            {section.items.map(q => {
              const isPassage = q.type === 'reading_passage'
              if (!isPassage) n += 1
              return (
                <div key={q.id} className="card p-5">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      {!isPassage && <span className="text-xs font-bold text-ink bg-gray-100 rounded-full w-6 h-6 inline-flex items-center justify-center">{n}</span>}
                      <span className="text-[11px] font-bold text-brand-600 bg-brand-50 border border-indigo-100 rounded-full px-2.5 py-0.5">
                        {TYPE_LABEL[q.type] ?? q.type}
                      </span>
                      {!isPassage && <span className="text-[11px] text-muted">{q.points} pt{q.points !== 1 ? 's' : ''}</span>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => setEditingId(editingId === q.id ? null : q.id)} disabled={pending} className="text-gray-400 hover:text-brand-600" title="Edit question">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDeleteQuestion(q.id)} disabled={pending} className="text-gray-400 hover:text-red-500" title="Remove question">
                        {busyId === q.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {editingId === q.id ? (
                    <QuestionEditor
                      q={q}
                      onDone={() => { setEditingId(null); router.refresh() }}
                      onCancel={() => setEditingId(null)}
                    />
                  ) : (
                    <>
                      {q.type !== 'multiple_choice' && <p className="text-sm font-semibold text-ink">{q.prompt}</p>}
                      <QuestionPreview q={q} />

                      {/* Student's answer + grading (not for display-only passages) */}
                      {!isPassage && <AnswerGrader q={q} submission={subByQuestion.get(q.id)} points={q.points} />}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        ))
      })()}
    </div>
  )
}

function QuestionPreview({ q }: { q: TestQuestion }) {
  if (q.type === 'reading_passage') {
    return (
      <div className="mt-2 rounded-lg bg-[#f8f7ff] border border-gray-100 px-4 py-3">
        <span className="text-[10px] font-bold uppercase tracking-wide text-muted">{q.data?.script ?? 'text'}</span>
        <p className="text-base text-ink leading-relaxed whitespace-pre-line mt-1">{q.data?.text}</p>
        {q.data?.romaji && <p className="text-sm text-brand-600 italic leading-relaxed whitespace-pre-line mt-1">{q.data.romaji}</p>}
        {q.data?.translation && <p className="text-xs text-muted mt-2 whitespace-pre-line">{q.data.translation}</p>}
      </div>
    )
  }
  if (q.type === 'multiple_choice') {
    return (
      <div className="mt-1">
        <p className="text-sm font-medium text-ink">{q.data?.question || q.prompt}</p>
        {q.data?.question_romaji && <p className="text-xs text-brand-600 italic mb-1.5">{q.data.question_romaji}</p>}
        <ul className="space-y-1 mt-1.5">
          {(q.data?.options ?? []).map((o: string, i: number) => (
            <li key={i} className={`text-sm flex items-center gap-1.5 ${i === q.data?.answer ? 'text-green-700 font-semibold' : 'text-muted'}`}>
              {i === q.data?.answer ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> : <span className="w-3.5 h-3.5 inline-block rounded-full border border-gray-300" />}
              {o}
            </li>
          ))}
        </ul>
      </div>
    )
  }
  if (q.type === 'fill_blank') {
    return (
      <div className="mt-1">
        <p className="text-sm text-ink">
          {q.data?.before}<span className="font-bold text-green-700"> {q.data?.answer} </span>{q.data?.after}
        </p>
        {q.data?.en && <p className="text-xs text-muted mt-0.5">{q.data.en}</p>}
        <p className="text-[11px] text-muted mt-1">Options: {(q.data?.options ?? []).join(' · ')}</p>
      </div>
    )
  }
  if (q.type === 'read_aloud') {
    return (
      <div className="mt-2">
        {q.data?.focus && <p className="text-xs text-muted mb-1.5">Focus: {q.data.focus}</p>}
        <ul className="space-y-1.5">
          {(q.data?.sentences ?? []).map((s: any, i: number) => (
            <li key={i} className="text-sm text-ink">
              {s.jp}
              {s.romaji && <span className="text-brand-600 italic text-xs"> · {s.romaji}</span>}
              <span className="text-muted text-xs"> — {s.en}</span>
            </li>
          ))}
        </ul>
      </div>
    )
  }
  if (q.type === 'speak') {
    return (
      <div className="mt-2">
        {q.data?.prompt_jp && <p className="text-sm text-ink">{q.data.prompt_jp}</p>}
        {q.data?.prompt_romaji && <p className="text-xs text-brand-600 italic">{q.data.prompt_romaji}</p>}
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

function AnswerGrader({ q, submission, points }: { q: TestQuestion; submission?: TestSubmission; points: number }) {
  const [pending, startTransition] = useTransition()
  const [score, setScore] = useState<string>(submission?.score != null ? String(submission.score) : '')
  const [feedback, setFeedback] = useState(submission?.teacher_feedback ?? '')
  const [saved, setSaved] = useState(false)

  if (!submission) {
    return <p className="text-xs text-muted mt-3 italic">No answer submitted yet.</p>
  }

  // Auto-graded choice questions: show the student's pick + correctness inline
  const isChoice = q.type === 'multiple_choice' || q.type === 'fill_blank'
  let choiceLabel: string | null = null
  let choiceCorrect = false
  if (isChoice && submission.answer_text != null) {
    if (q.type === 'multiple_choice') {
      const idx = Number(submission.answer_text)
      choiceLabel = (q.data?.options ?? [])[idx] ?? String(submission.answer_text)
      choiceCorrect = idx === Number(q.data?.answer)
    } else {
      choiceLabel = String(submission.answer_text)
      choiceCorrect = choiceLabel.trim() === String(q.data?.answer ?? '').trim()
    }
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
      {isChoice ? (
        <p className={`text-sm font-semibold ${choiceCorrect ? 'text-green-600' : 'text-red-600'}`}>
          Chose: {choiceLabel ?? '—'} {choiceCorrect ? '✓' : '✗'}
        </p>
      ) : (
        <>
          {submission.answer_text && <p className="text-sm text-ink whitespace-pre-line">{submission.answer_text}</p>}
          {submission.audio_url && <audio controls src={submission.audio_url} className="w-full h-9" />}
          {!submission.answer_text && !submission.audio_url && <p className="text-xs text-muted italic">Empty answer.</p>}
        </>
      )}

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
