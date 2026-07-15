'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Clock, Loader2, Mic, Square, Send, RotateCcw, Sparkles, CheckCircle2, Lightbulb } from 'lucide-react'
import { startTestAttempt, saveWrittenAnswer, saveChoiceAnswer, submitTest } from '@/app/actions/tests'
import type { TestQuestion, TestSubmission } from '@/lib/types'
import { groupBySection } from '@/lib/utils'

const TYPE_LABEL: Record<string, string> = {
  written: '✍️ Written',
  speak: '🎙️ Speaking',
  read_aloud: '🎙️ Read aloud',
  reading_passage: '📖 Reading',
  multiple_choice: '✅ Multiple choice',
  fill_blank: '✏️ Fill in the blank',
}

export default function TestRunner({
  test,
  questions,
  studentId,
  initialSubmissions,
  startedAt,
}: {
  test: { id: string; title: string; instructions?: string | null; duration_minutes: number; lesson_numbers: number[] }
  questions: TestQuestion[]
  studentId: string
  initialSubmissions: TestSubmission[]
  startedAt: string | null
}) {
  const router = useRouter()
  const ordered = [...questions].sort((a, b) => a.sort_order - b.sort_order)
  const [started, setStarted] = useState<string | null>(startedAt)
  const [starting, setStarting] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // ── Not started yet: show the start screen ────────────────────────────────
  if (!started) {
    const begin = async () => {
      setStarting(true)
      const res = await startTestAttempt(test.id)
      if (res.success && res.startedAt) setStarted(res.startedAt)
      else setStarting(false)
    }
    return (
      <div className="card p-8 text-center max-w-lg mx-auto">
        <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center text-white mb-4"
          style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}>
          <Sparkles className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold text-ink">{test.title}</h1>
        {test.lesson_numbers?.length > 0 && (
          <p className="text-sm text-muted mt-1">Covering lessons {test.lesson_numbers.join(', ')}</p>
        )}
        <div className="inline-flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full bg-brand-50 text-brand-600 text-sm font-semibold">
          <Clock className="w-4 h-4" /> {test.duration_minutes} minutes · {ordered.length} questions
        </div>
        {test.instructions && <p className="text-sm text-muted mt-4 whitespace-pre-line">{test.instructions}</p>}
        <p className="text-xs text-muted mt-4">
          The timer starts as soon as you begin and keeps running even if you close the page. Answer every
          question, then submit before time runs out.
        </p>
        <button onClick={begin} disabled={starting} className="btn-primary w-full justify-center mt-6 disabled:opacity-50">
          {starting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {starting ? 'Starting…' : 'Start test'}
        </button>
      </div>
    )
  }

  return (
    <StartedTest
      test={test}
      ordered={ordered}
      studentId={studentId}
      initialSubmissions={initialSubmissions}
      startedAt={started}
      submitting={submitting}
      onSubmit={async () => {
        setSubmitting(true)
        await submitTest(test.id)
        router.refresh()
      }}
    />
  )
}

function StartedTest({
  test, ordered, studentId, initialSubmissions, startedAt, submitting, onSubmit,
}: {
  test: { id: string; title: string; duration_minutes: number }
  ordered: TestQuestion[]
  studentId: string
  initialSubmissions: TestSubmission[]
  startedAt: string
  submitting: boolean
  onSubmit: () => void
}) {
  const endTime = new Date(startedAt).getTime() + test.duration_minutes * 60_000
  const [remaining, setRemaining] = useState(() => Math.max(0, endTime - Date.now()))
  const submitRef = useRef(onSubmit)
  submitRef.current = onSubmit
  const autoSubmitted = useRef(false)

  useEffect(() => {
    const id = setInterval(() => {
      const left = Math.max(0, endTime - Date.now())
      setRemaining(left)
      if (left === 0 && !autoSubmitted.current) {
        autoSubmitted.current = true
        submitRef.current()
      }
    }, 1000)
    return () => clearInterval(id)
  }, [endTime])

  const mins = Math.floor(remaining / 60_000)
  const secs = Math.floor((remaining % 60_000) / 1000)
  const low = remaining < 5 * 60_000

  return (
    <div className="space-y-4 pb-24">
      {/* Sticky timer */}
      <div className="sticky top-14 z-30 -mx-4 sm:mx-0">
        <div className={`flex items-center justify-between gap-3 px-4 py-3 sm:rounded-xl border ${low ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'} shadow-sm`}>
          <div>
            <h1 className="font-bold text-ink text-sm">{test.title}</h1>
            <p className="text-xs text-muted">{ordered.length} questions</p>
          </div>
          <div className={`inline-flex items-center gap-1.5 font-bold tabular-nums text-lg ${low ? 'text-red-600' : 'text-brand-600'}`}>
            <Clock className="w-4 h-4" />
            {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
          </div>
        </div>
      </div>

      {(() => {
        let n = 0
        return groupBySection(ordered).map(section => (
          <div key={section.key} className="space-y-3">
            <div className="flex items-center gap-2 pt-2">
              {section.part && <span className="text-[11px] font-bold uppercase tracking-wide text-white bg-brand-600 rounded-full px-2.5 py-0.5">{section.part}</span>}
              <h2 className="text-base font-bold text-ink">{section.title}</h2>
            </div>
            {section.items.map(q => {
              const isPassage = q.type === 'reading_passage'
              if (!isPassage) n += 1
              return (
                <div key={q.id} className="card p-5">
                  <div className="flex items-center gap-2 mb-2">
                    {!isPassage && <span className="text-xs font-bold text-ink bg-gray-100 rounded-full w-6 h-6 inline-flex items-center justify-center">{n}</span>}
                    <span className="text-[11px] font-bold text-brand-600 bg-brand-50 border border-indigo-100 rounded-full px-2.5 py-0.5">
                      {TYPE_LABEL[q.type] ?? q.type}
                    </span>
                    {!isPassage && <span className="text-[11px] text-muted">{q.points} pt{q.points !== 1 ? 's' : ''}</span>}
                  </div>
                  {q.type !== 'multiple_choice' && <p className="text-sm font-semibold text-ink mb-2">{q.prompt}</p>}

                  <QuestionBody
                    q={q}
                    testId={test.id}
                    studentId={studentId}
                    initial={initialSubmissions.find(s => s.question_id === q.id)}
                  />
                </div>
              )
            })}
          </div>
        ))
      })()}

      {/* Submit bar */}
      <div className="fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur border-t border-gray-100 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <span className="text-xs text-muted hidden sm:block">
            Every answer saves as you go — recordings too. Submit once you&apos;re done.
          </span>
          <button
            onClick={() => { if (confirm('Submit your test? You will not be able to change your answers afterwards.')) onSubmit() }}
            disabled={submitting}
            className="btn-primary justify-center ml-auto disabled:opacity-50"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {submitting ? 'Submitting…' : 'Submit test'}
          </button>
        </div>
      </div>
    </div>
  )
}

function QuestionBody({
  q, testId, studentId, initial,
}: {
  q: TestQuestion
  testId: string
  studentId: string
  initial?: TestSubmission
}) {
  if (q.type === 'reading_passage') {
    return (
      <div className="rounded-lg px-4 py-3 border border-gray-100 bg-[#f8f7ff]">
        <p className="text-base text-ink leading-relaxed whitespace-pre-line">{q.data?.text}</p>
        {q.data?.romaji && <p className="text-sm text-brand-600 italic leading-relaxed whitespace-pre-line mt-1">{q.data.romaji}</p>}
      </div>
    )
  }

  const body = (() => {
    if (q.type === 'multiple_choice') {
      return <ChoiceAnswer testId={testId} questionId={q.id} prompt={q.prompt} data={q.data} initial={initial?.answer_text ?? ''} />
    }
    if (q.type === 'fill_blank') {
      return <FillBlankAnswer testId={testId} questionId={q.id} data={q.data} initial={initial?.answer_text ?? ''} />
    }
    if (q.type === 'written') {
      return <WrittenAnswer testId={testId} questionId={q.id} data={q.data} initial={initial?.answer_text ?? ''} />
    }
    // speak / read_aloud
    return (
      <div>
        {q.type === 'read_aloud' && (
          <div className="mb-3">
            {q.data?.focus && <p className="text-xs text-muted mb-1.5">Focus: {q.data.focus}</p>}
            <div className="space-y-1.5">
              {(q.data?.sentences ?? []).map((s: any, j: number) => (
                <div key={j} className="bg-white rounded-lg px-3 py-2 border border-gray-100">
                  <p className="text-base text-ink">{s.jp}</p>
                  {s.romaji && <p className="text-sm text-brand-600 italic mt-0.5">{s.romaji}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
        {q.type === 'speak' && (
          <div className="mb-3 bg-[#f8f7ff] rounded-lg px-3 py-2.5 border border-gray-100">
            {q.data?.prompt_jp && <p className="text-base text-ink">{q.data.prompt_jp}</p>}
            {q.data?.prompt_romaji && <p className="text-sm text-brand-600 italic mt-0.5">{q.data.prompt_romaji}</p>}
          </div>
        )}
        <TestAudioAnswer testId={testId} questionId={q.id} studentId={studentId} initial={initial} />
      </div>
    )
  })()

  return (
    <>
      {body}
      <Hint text={q.data?.hint} />
    </>
  )
}

// A nudge the student chooses to reveal — hidden until they ask for it, so it
// doesn't do the work for them.
function Hint({ text }: { text?: string }) {
  const [shown, setShown] = useState(false)
  if (!text) return null

  if (!shown) {
    return (
      <button
        onClick={() => setShown(true)}
        className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-brand-600"
      >
        <Lightbulb className="w-3.5 h-3.5" /> Need a hint?
      </button>
    )
  }
  return (
    <div className="mt-2.5 flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
      <Lightbulb className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
      <p className="text-xs text-amber-800">{text}</p>
    </div>
  )
}

function WrittenAnswer({
  testId, questionId, data, initial,
}: {
  testId: string
  questionId: string
  data: any
  initial: string
}) {
  const [value, setValue] = useState(initial)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const persist = useCallback((text: string) => {
    setStatus('saving')
    saveWrittenAnswer({ testId, questionId, answerText: text }).then(() => setStatus('saved')).catch(() => setStatus('idle'))
  }, [testId, questionId])

  function onChange(text: string) {
    setValue(text)
    setStatus('idle')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => persist(text), 800)
  }

  return (
    <div>
      {data?.context && <p className="text-sm text-ink bg-[#f8f7ff] rounded-lg px-3 py-2 mb-2">{data.context}</p>}
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        onBlur={() => { if (timer.current) clearTimeout(timer.current); persist(value) }}
        rows={4}
        placeholder="Type your answer…"
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
      />
      <div className="h-4 mt-1">
        {status === 'saving' && <span className="text-[11px] text-muted">Saving…</span>}
        {status === 'saved' && <span className="text-[11px] text-green-600 inline-flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Saved</span>}
      </div>
    </div>
  )
}

function ChoiceAnswer({
  testId, questionId, prompt, data, initial,
}: {
  testId: string
  questionId: string
  prompt: string
  data: any
  initial: string
}) {
  const [selected, setSelected] = useState<number | null>(initial === '' ? null : Number(initial))
  const opts: string[] = data?.options ?? []

  function choose(i: number) {
    setSelected(i)
    saveChoiceAnswer({ testId, questionId, answer: String(i) }).catch(() => {})
  }

  return (
    <div>
      <p className="text-sm font-semibold text-ink">{data?.question || prompt}</p>
      {data?.question_romaji && <p className="text-xs text-brand-600 italic mb-2">{data.question_romaji}</p>}
      <div className="flex flex-col gap-2 mt-3">
        {opts.map((o, i) => (
          <button
            key={i}
            onClick={() => choose(i)}
            className={`text-left rounded-lg border px-3.5 py-2.5 text-sm transition-colors ${
              selected === i ? 'border-brand-400 bg-brand-50 text-brand-700 font-semibold' : 'border-gray-200 bg-white hover:border-brand-200 hover:bg-brand-50'
            }`}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  )
}

function FillBlankAnswer({
  testId, questionId, data, initial,
}: {
  testId: string
  questionId: string
  data: any
  initial: string
}) {
  const [selected, setSelected] = useState<string>(initial)
  const opts: string[] = data?.options ?? []

  function choose(o: string) {
    setSelected(o)
    saveChoiceAnswer({ testId, questionId, answer: o }).catch(() => {})
  }

  return (
    <div>
      <div className="bg-[#f8f7ff] rounded-lg px-3.5 py-3 my-1 text-base text-ink">
        {data?.before}
        <span className="inline-block min-w-[52px] text-center font-bold border-b-2 px-2 mx-0.5 text-brand-600 border-brand-400">
          {selected || '＿＿'}
        </span>
        {data?.after}
      </div>
      <div className="flex flex-wrap gap-2 mt-2">
        {opts.map((o, i) => (
          <button
            key={i}
            onClick={() => choose(o)}
            className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
              selected === o ? 'border-brand-400 bg-brand-50 text-brand-700 font-semibold' : 'border-gray-200 bg-white hover:border-brand-200 hover:bg-brand-50'
            }`}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  )
}

// iOS Safari can't record audio/webm — pick a format the browser supports.
function pickRecordingType(): string {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return ''
  for (const t of ['audio/webm', 'audio/mp4', 'audio/ogg']) if (MediaRecorder.isTypeSupported(t)) return t
  return ''
}
function extForType(type: string): string {
  if (type.includes('mp4')) return 'm4a'
  if (type.includes('ogg')) return 'ogg'
  return 'webm'
}

// Recording saves itself the moment the student stops. There is no per-answer
// "send": they record, listen back, re-record if they want, and submit the whole
// test once at the end.
//
// The upload still happens per answer rather than being held in memory until
// submit — the test auto-submits when the timer runs out, and a tab crash or a
// refresh would otherwise take every recording with it.
function TestAudioAnswer({
  testId, questionId, studentId, initial,
}: {
  testId: string
  questionId: string
  studentId: string
  initial?: TestSubmission
}) {
  const supabase = createClient()
  const [savedUrl, setSavedUrl] = useState<string | null>(initial?.audio_url ?? null)
  const [localUrl, setLocalUrl] = useState<string | null>(null)
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const recRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Held so a failed upload can be retried without making them record again.
  const lastFileRef = useRef<File | null>(null)

  async function save(file: File) {
    setSaving(true); setError('')
    try {
      const ext = file.name.split('.').pop() ?? 'webm'
      const path = `tests/${testId}/q-${questionId}-${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('student-audio').upload(path, file)
      if (upErr) { setError('Could not save that recording.'); return }
      const { data: { publicUrl } } = supabase.storage.from('student-audio').getPublicUrl(path)
      const { error: insErr } = await supabase
        .from('test_submissions')
        .upsert(
          { test_id: testId, question_id: questionId, student_id: studentId, audio_url: publicUrl, file_name: file.name },
          { onConflict: 'question_id,student_id' },
        )
      if (insErr) { setError('Could not save that recording.'); return }
      setSavedUrl(publicUrl)
    } catch {
      setError('Could not save that recording.')
    } finally {
      setSaving(false)
    }
  }

  async function start() {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mime = pickRecordingType()
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      chunksRef.current = []
      rec.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      rec.onstop = () => {
        stream.getTracks().forEach(t => t.stop())
        const type = rec.mimeType || mime || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type })
        const file = new File([blob], `recording-${Date.now()}.${extForType(type)}`, { type })
        lastFileRef.current = file
        setLocalUrl(prev => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(file) })
        save(file)
      }
      rec.start(1000)
      recRef.current = rec
      setRecording(true); setSeconds(0)
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000)
    } catch (e: any) {
      if (e?.name === 'NotAllowedError' || e?.name === 'SecurityError') setError('Microphone access denied.')
      else setError('Recording is not supported on this browser.')
    }
  }

  function stop() {
    recRef.current?.stop()
    if (timerRef.current) clearInterval(timerRef.current)
    setRecording(false); setSeconds(0)
  }

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  const playable = localUrl ?? savedUrl

  if (recording) {
    return (
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-red-600">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> {fmt(seconds)}
        </span>
        <button onClick={stop} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500 text-white text-xs font-semibold hover:bg-red-600">
          <Square className="w-3 h-3" /> Stop
        </button>
      </div>
    )
  }

  return (
    <div>
      {playable ? (
        <div className="space-y-2">
          <audio controls src={playable} className="w-full h-9" />
          <div className="flex items-center gap-3 flex-wrap">
            {saving ? (
              <span className="text-xs text-muted inline-flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin" /> Saving…
              </span>
            ) : error ? (
              <button onClick={() => lastFileRef.current && save(lastFileRef.current)} className="text-xs font-semibold text-red-600 hover:underline">
                Try saving again
              </button>
            ) : (
              <span className="text-xs font-semibold text-green-600 inline-flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Saved
              </span>
            )}
            <button onClick={start} disabled={saving} className="text-xs text-muted hover:text-ink inline-flex items-center gap-1 disabled:opacity-50">
              <RotateCcw className="w-3 h-3" /> Record again
            </button>
          </div>
        </div>
      ) : (
        <button onClick={start} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-brand-600 text-white text-xs font-semibold hover:bg-brand-700">
          <Mic className="w-3.5 h-3.5" /> Record answer
        </button>
      )}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}
