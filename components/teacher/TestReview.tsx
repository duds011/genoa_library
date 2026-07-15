'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Loader2, Clock, FileText, Sparkles, Save, CheckCircle2, Pencil, Lightbulb, Mail, Image as ImageIcon } from 'lucide-react'
import { setTestStatus, deleteTest, deleteTestQuestion, gradeTestAnswer, updateTest } from '@/app/actions/tests'
import { sendTestResults } from '@/app/actions/notifications'
import type { TestQuestion, TestSubmission } from '@/lib/types'
import { groupBySection, testScore } from '@/lib/utils'
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
  test: { id: string; title: string; instructions?: string | null; status: string; duration_minutes: number; lesson_numbers: number[]; student_id: string; config?: { focus?: string } | null }
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
      <TestImageQueue questions={ordered} />
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

        {test.config?.focus && (
          <div className="mt-3 rounded-xl border border-indigo-100 bg-brand-50 px-4 py-2.5">
            <p className="text-[10px] font-bold text-brand-600 uppercase tracking-widest mb-0.5">You asked the AI to focus on</p>
            <p className="text-sm text-ink whitespace-pre-line">{test.config.focus}</p>
          </div>
        )}

        <LessonCoverage questions={ordered} lessonNumbers={test.lesson_numbers ?? []} />

        {submitted && <ScoreSummary testId={test.id} questions={ordered} submissions={submissions} />}
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
                      {q.data?.lesson_number != null && (
                        <span className="text-[11px] font-semibold text-muted bg-gray-100 rounded-full px-2 py-0.5">
                          Lesson {q.data.lesson_number}
                        </span>
                      )}
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
                      <QuestionImage q={q} />
                      <QuestionPreview q={q} />

                      {q.data?.hint && (
                        <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5 mt-2 inline-flex items-start gap-1.5">
                          <Lightbulb className="w-3 h-3 shrink-0 mt-0.5" />
                          <span>Hint (the student only sees this if they ask): {q.data.hint}</span>
                        </p>
                      )}

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

// Draws whatever pictures the test still needs, one at a time, while Noa reads
// the questions. Generation is far too slow to sit inside buildTest, so the
// draft is written first and the images fill in behind it. Sequential on
// purpose: several minutes of parallel image jobs is a good way to get rate
// limited, and she can only look at one question at a time anyway.
function TestImageQueue({ questions }: { questions: TestQuestion[] }) {
  const router = useRouter()
  const pending = questions.filter(q => q.image_status === 'pending')
  const started = useRef(false)
  const [done, setDone] = useState(0)
  const [failed, setFailed] = useState(0)

  useEffect(() => {
    if (started.current || pending.length === 0) return
    started.current = true

    let cancelled = false
    ;(async () => {
      for (const q of pending) {
        if (cancelled) return
        try {
          const res = await fetch('/api/test-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ questionId: q.id }),
          })
          if (cancelled) return
          if (res.ok) setDone(n => n + 1)
          else setFailed(n => n + 1)
        } catch {
          if (!cancelled) setFailed(n => n + 1)
        }
        if (!cancelled) router.refresh()
      }
    })()

    return () => { cancelled = true }
  }, [pending, router])

  if (pending.length === 0) return null

  return (
    <div className="card p-4 flex items-center gap-3 border-purple-100 bg-purple-50/60">
      <Loader2 className="w-4 h-4 animate-spin text-purple-600 shrink-0" />
      <div>
        <p className="text-sm font-semibold text-ink">
          Drawing the pictures… {done + failed} of {pending.length}
        </p>
        <p className="text-xs text-muted">
          This takes a minute or two each. You can read through the test meanwhile — they&apos;ll appear as they finish.
          {failed > 0 && ` ${failed} didn't work; you can retry those below.`}
        </p>
      </div>
    </div>
  )
}

// How many questions came out of each lesson Noa picked. The AI is told to
// cover all of them, so a lesson showing 0 is worth her knowing about before
// she publishes — that is the whole point of choosing the lessons.
function LessonCoverage({ questions, lessonNumbers }: { questions: TestQuestion[]; lessonNumbers: number[] }) {
  if (lessonNumbers.length === 0) return null

  const counts = lessonNumbers.map(n => ({
    lesson: n,
    count: questions.filter(q => q.data?.lesson_number === n && q.type !== 'reading_passage').length,
  }))
  // Older tests predate the tagging, so don't cry wolf when nothing is tagged.
  if (counts.every(c => c.count === 0)) return null

  const missing = counts.filter(c => c.count === 0)

  return (
    <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-3">
      <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5">Lesson coverage</p>
      <div className="flex flex-wrap gap-1.5">
        {counts.map(c => (
          <span
            key={c.lesson}
            className={`text-xs font-semibold rounded-lg px-2.5 py-1 border ${
              c.count === 0
                ? 'text-orange-700 bg-orange-50 border-orange-200'
                : 'text-ink bg-white border-gray-200'
            }`}
          >
            Lesson {c.lesson}: {c.count === 0 ? 'nothing' : `${c.count} question${c.count !== 1 ? 's' : ''}`}
          </span>
        ))}
      </div>
      {missing.length > 0 && (
        <p className="text-[11px] text-orange-700 mt-2">
          Nothing came from lesson{missing.length !== 1 ? 's' : ''} {missing.map(m => m.lesson).join(', ')} — rebuild if that matters.
        </p>
      )}
    </div>
  )
}

// What the student scored, broken down by part. Choice questions are graded
// automatically on submit; speaking/written wait on Noa, so the total is marked
// provisional until she has graded everything the student answered.
function ScoreSummary({ testId, questions, submissions }: { testId: string; questions: TestQuestion[]; submissions: TestSubmission[] }) {
  const total = testScore(questions, submissions)
  const parts = groupBySection(questions)
    .map(section => ({ ...section, ...testScore(section.items, submissions) }))
    .filter(section => section.maxScore > 0)

  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [sendError, setSendError] = useState('')

  async function send() {
    setSending(true); setSendError('')
    const res = await sendTestResults(testId)
    setSending(false)
    if (!res.ok) { setSendError(res.error ?? 'Could not send the email.'); return }
    setSent(true)
  }

  return (
    <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3.5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest">Student score</p>
          <p className="text-2xl font-bold text-emerald-700 mt-0.5 tabular-nums">
            {total.score} <span className="text-base font-semibold text-emerald-600/70">/ {total.maxScore}</span>
            <span className="text-base font-semibold text-emerald-600/70 ml-2">{total.percent}%</span>
          </p>
        </div>
        {total.awaiting > 0 ? (
          <span className="text-xs font-semibold text-orange-700 bg-orange-100 border border-orange-200 rounded-full px-3 py-1">
            Provisional — {total.awaiting} answer{total.awaiting !== 1 ? 's' : ''} still to grade below
          </span>
        ) : (
          <span className="text-xs font-semibold text-emerald-700 bg-white border border-emerald-200 rounded-full px-3 py-1">
            ✓ Fully graded
          </span>
        )}
      </div>

      {parts.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {parts.map(p => (
            <span key={p.key} className="text-xs font-semibold text-emerald-800 bg-white/70 border border-emerald-100 rounded-lg px-2.5 py-1">
              {p.title}: <span className="tabular-nums">{p.score}/{p.maxScore}</span>
              {p.awaiting > 0 && <span className="text-orange-600 font-normal"> ({p.awaiting} to grade)</span>}
            </span>
          ))}
        </div>
      )}

      {/* Results go out only when she says so — she grades one answer at a time,
          so anything automatic would email the student halfway through. */}
      <div className="mt-3 flex items-center gap-2 flex-wrap border-t border-emerald-100 pt-3">
        {sent ? (
          <span className="text-xs font-semibold text-emerald-700 inline-flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Results emailed to your student
          </span>
        ) : (
          <>
            <button onClick={send} disabled={sending} className="btn-primary text-xs disabled:opacity-50">
              {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
              {sending ? 'Sending…' : 'Send results to student'}
            </button>
            <span className="text-[11px] text-muted">
              {total.awaiting > 0
                ? `${total.awaiting} answer${total.awaiting !== 1 ? 's' : ''} still ungraded — they'd see ${total.score}/${total.maxScore}.`
                : 'They get their score and your feedback by email.'}
            </span>
          </>
        )}
        {sendError && <span className="text-[11px] text-red-500">{sendError}</span>}
      </div>
    </div>
  )
}

// The picture as the student will see it, plus a way out when a generation
// fails or comes back wrong — she can redraw it or drop it, and the question
// still works without it.
function QuestionImage({ q }: { q: TestQuestion }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function redraw() {
    setBusy(true)
    try {
      await fetch('/api/test-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: q.id }),
      })
    } finally {
      setBusy(false)
      router.refresh()
    }
  }

  if (q.image_status === 'none' || !q.image_status) return null

  if (q.image_status === 'ready' && q.image_url) {
    return (
      <div className="mt-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={q.image_url} alt="" className="rounded-xl border border-gray-100 w-full max-w-md" />
        <button onClick={redraw} disabled={busy} className="mt-1.5 text-[11px] font-semibold text-muted hover:text-brand-600 inline-flex items-center gap-1 disabled:opacity-50">
          {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <ImageIcon className="w-3 h-3" />}
          {busy ? 'Drawing…' : 'Draw a different picture'}
        </button>
      </div>
    )
  }

  if (q.image_status === 'failed') {
    return (
      <div className="mt-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 flex items-center gap-2 flex-wrap">
        <span className="text-xs text-orange-800">The picture for this question didn&apos;t generate.</span>
        <button onClick={redraw} disabled={busy} className="text-xs font-semibold text-orange-800 hover:underline disabled:opacity-50">
          {busy ? 'Trying…' : 'Try again'}
        </button>
      </div>
    )
  }

  return (
    <div className="mt-2 rounded-xl border border-gray-100 bg-gray-50 px-3 py-6 flex items-center justify-center gap-2">
      <Loader2 className="w-3.5 h-3.5 animate-spin text-muted" />
      <span className="text-xs text-muted">Drawing the picture…</span>
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
  const router = useRouter()
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
      router.refresh()   // keep the score summary at the top in step with this grade
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
