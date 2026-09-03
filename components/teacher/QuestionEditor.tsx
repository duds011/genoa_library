'use client'

import { useState } from 'react'
import { Loader2, Plus, Trash2, Save, X, Info } from 'lucide-react'
import { updateTestQuestion } from '@/app/actions/tests'
import { hasKanji, kanjiWithoutReading } from '@/lib/furigana'
import Furigana from '@/components/Furigana'
import type { TestQuestion } from '@/lib/types'

export default function QuestionEditor({
  q,
  onDone,
  onCancel,
}: {
  q: TestQuestion
  onDone: () => void
  onCancel: () => void
}) {
  const [prompt, setPrompt] = useState(q.prompt ?? '')
  const [points, setPoints] = useState<number>(q.points ?? 1)
  // Deep-clone the data so edits don't mutate the original until saved
  const [data, setData] = useState<any>(() => JSON.parse(JSON.stringify(q.data ?? {})))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function set(field: string, value: any) {
    setData((d: any) => ({ ...d, [field]: value }))
  }

  async function save() {
    setSaving(true); setError('')
    const res = await updateTestQuestion({ questionId: q.id, prompt, points, data })
    setSaving(false)
    if (!res.success) { setError(res.error ?? 'Could not save.'); return }
    onDone()
  }

  // Every place this question holds Japanese — used to decide whether the
  // furigana guide is worth showing at all.
  const japaneseHere = [
    prompt, data.prompt_jp, data.text, data.question, data.before, data.after,
    data.answer, data.context, data.reference_answer,
    ...(data.options ?? []),
    ...(data.sentences ?? []).map((s: any) => s?.jp),
  ]

  return (
    <div className="mt-1 space-y-3">
      {japaneseHere.some(t => hasKanji(t)) && <FuriganaGuide />}

      <JpField label="Prompt / task shown to the student" value={prompt} onChange={setPrompt} rows={2} />

      {q.type !== 'reading_passage' && (
        <Field label="Points">
          <input type="number" min={0} value={points} onChange={e => setPoints(Number(e.target.value))} className={`${inputCls} w-24`} />
        </Field>
      )}

      {q.type === 'speak' && (
        <>
          <JpField label="Japanese (prompt_jp)" value={data.prompt_jp ?? ''} onChange={v => set('prompt_jp', v)} />
          <Field label="Romaji (prompt_romaji)"><input value={data.prompt_romaji ?? ''} onChange={e => set('prompt_romaji', e.target.value)} className={inputCls} /></Field>
          <Field label="Hint — shown only if the student asks for it">
            <input value={data.hint ?? ''} onChange={e => set('hint', e.target.value)} placeholder="A nudge, not the answer or a translation" className={inputCls} />
          </Field>
        </>
      )}

      {q.type === 'read_aloud' && (
        <>
          <Field label="Focus"><input value={data.focus ?? ''} onChange={e => set('focus', e.target.value)} className={inputCls} /></Field>
          <SentencesEditor sentences={data.sentences ?? []} onChange={s => set('sentences', s)} />
        </>
      )}

      {q.type === 'reading_passage' && (
        <>
          <JpField label="Passage (Japanese)" value={data.text ?? ''} onChange={v => set('text', v)} rows={6} />
          <Field label="Romaji reading"><textarea value={data.romaji ?? ''} onChange={e => set('romaji', e.target.value)} rows={4} className={inputCls} /></Field>
        </>
      )}

      {q.type === 'multiple_choice' && (
        <>
          <JpField label="Question" value={data.question ?? ''} onChange={v => set('question', v)} />
          <Field label="Question romaji"><input value={data.question_romaji ?? ''} onChange={e => set('question_romaji', e.target.value)} className={inputCls} /></Field>
          <OptionsEditor
            options={data.options ?? []}
            correctIndex={typeof data.answer === 'number' ? data.answer : 0}
            onChange={(opts, answer) => setData((d: any) => ({ ...d, options: opts, answer }))}
          />
        </>
      )}

      {q.type === 'fill_blank' && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <JpField label="Text before blank" value={data.before ?? ''} onChange={v => set('before', v)} />
            <JpField label="Text after blank" value={data.after ?? ''} onChange={v => set('after', v)} />
          </div>
          <FillOptionsEditor
            options={data.options ?? []}
            answer={data.answer ?? ''}
            onChange={(opts, answer) => setData((d: any) => ({ ...d, options: opts, answer }))}
          />
        </>
      )}

      {q.type === 'written' && (
        <>
          <JpField label="Context (optional)" value={data.context ?? ''} onChange={v => set('context', v)} rows={2} />
          <JpField label="Model answer (for your grading)" value={data.reference_answer ?? ''} onChange={v => set('reference_answer', v)} rows={2} />
          <Field label="Grading note (optional)"><input value={data.guidance ?? ''} onChange={e => set('guidance', e.target.value)} className={inputCls} /></Field>
        </>
      )}

      {q.type !== 'reading_passage' && q.type !== 'speak' && (
        <Field label="Hint — shown only if the student asks for it">
          <input value={data.hint ?? ''} onChange={e => set('hint', e.target.value)} placeholder="A nudge, not the answer or a translation" className={inputCls} />
        </Field>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex items-center gap-2 pt-1">
        <button onClick={save} disabled={saving} className="btn-primary text-xs disabled:opacity-50">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save changes
        </button>
        <button onClick={onCancel} disabled={saving} className="btn-ghost text-xs"><X className="w-3.5 h-3.5" /> Cancel</button>
      </div>
    </div>
  )
}

const inputCls = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold text-muted uppercase tracking-wide">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  )
}

// Shown once per question that contains kanji, so the bracket syntax is never
// something Noa has to remember or guess at.
function FuriganaGuide() {
  return (
    <div className="rounded-xl border border-indigo-100 bg-brand-50 px-3.5 py-2.5 flex items-start gap-2">
      <Info className="w-3.5 h-3.5 text-brand-600 shrink-0 mt-0.5" />
      <div className="text-[11px] text-ink/80 leading-relaxed">
        <span className="font-semibold text-brand-700">Furigana.</span>{' '}
        Put the reading in square brackets right after the kanji it belongs to — <code className="bg-white/70 rounded px-1">お茶[ちゃ]</code> shows as{' '}
        <span className="text-sm whitespace-nowrap"><Furigana text="お茶[ちゃ]" /></span>.
        Split at the okurigana: <code className="bg-white/70 rounded px-1">行[い]きます</code>, not 行きます[いきます].
        Fix a wrong reading by editing what&apos;s inside the brackets — the preview under each box updates as you type.
      </div>
    </div>
  )
}

// A Japanese text box with the rendered result underneath, so a reading can be
// corrected and checked without leaving the editor.
function JpField({
  label, value, onChange, rows,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  rows?: number
}) {
  return (
    <Field label={label}>
      {rows ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} rows={rows} className={inputCls} />
      ) : (
        <input value={value} onChange={e => onChange(e.target.value)} className={inputCls} />
      )}
      <FuriganaPreview text={value} />
    </Field>
  )
}

function FuriganaPreview({ text, compact }: { text: string; compact?: boolean }) {
  if (!hasKanji(text)) return null
  const bare = kanjiWithoutReading(text)

  return (
    <div className={`mt-1.5 rounded-lg border border-indigo-100 bg-[#f8f7ff] px-3 ${compact ? 'py-1.5' : 'py-2'}`}>
      {!compact && (
        <span className="block text-[10px] font-bold uppercase tracking-wide text-muted mb-0.5">Student sees</span>
      )}
      <span className="text-base text-ink whitespace-pre-line"><Furigana text={text} /></span>
      {bare.length > 0 && (
        <span className="block text-[11px] text-orange-600 mt-1">
          No reading yet on {bare.join(' ')} — add it as {bare[0]}[reading].
        </span>
      )}
    </div>
  )
}

function OptionsEditor({
  options, correctIndex, onChange,
}: {
  options: string[]
  correctIndex: number
  onChange: (opts: string[], answer: number) => void
}) {
  function edit(i: number, val: string) {
    const next = [...options]; next[i] = val; onChange(next, correctIndex)
  }
  function remove(i: number) {
    const next = options.filter((_, j) => j !== i)
    let answer = correctIndex
    if (i === correctIndex) answer = 0
    else if (i < correctIndex) answer = correctIndex - 1
    onChange(next, Math.min(answer, Math.max(0, next.length - 1)))
  }
  function add() { onChange([...options, ''], correctIndex) }

  return (
    <div>
      <span className="text-[11px] font-semibold text-muted uppercase tracking-wide">Options — select the correct one</span>
      <div className="mt-1 space-y-2">
        {options.map((o, i) => (
          <div key={i} className="flex items-start gap-2">
            <input type="radio" name="correct" checked={i === correctIndex} onChange={() => onChange(options, i)} className="accent-brand-600 w-4 h-4 shrink-0 mt-2.5" title="Mark correct" />
            <div className="flex-1">
              <input value={o} onChange={e => edit(i, e.target.value)} className={inputCls} />
              <FuriganaPreview text={o} compact />
            </div>
            <button onClick={() => remove(i)} className="text-gray-400 hover:text-red-500 shrink-0 mt-2.5" title="Remove option"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
      </div>
      <button onClick={add} className="mt-2 text-xs font-semibold text-brand-600 inline-flex items-center gap-1 hover:underline"><Plus className="w-3.5 h-3.5" /> Add option</button>
    </div>
  )
}

function FillOptionsEditor({
  options, answer, onChange,
}: {
  options: string[]
  answer: string
  onChange: (opts: string[], answer: string) => void
}) {
  function edit(i: number, val: string) {
    const prev = options[i]
    const next = [...options]; next[i] = val
    onChange(next, answer === prev ? val : answer)
  }
  function remove(i: number) {
    const next = options.filter((_, j) => j !== i)
    onChange(next, answer === options[i] ? (next[0] ?? '') : answer)
  }
  function add() { onChange([...options, ''], answer) }

  return (
    <div>
      <span className="text-[11px] font-semibold text-muted uppercase tracking-wide">Options — select the correct answer</span>
      <div className="mt-1 space-y-2">
        {options.map((o, i) => (
          <div key={i} className="flex items-start gap-2">
            <input type="radio" name="fillcorrect" checked={o !== '' && o === answer} onChange={() => onChange(options, o)} className="accent-brand-600 w-4 h-4 shrink-0 mt-2.5" title="Mark correct" />
            <div className="flex-1">
              <input value={o} onChange={e => edit(i, e.target.value)} className={inputCls} />
              <FuriganaPreview text={o} compact />
            </div>
            <button onClick={() => remove(i)} className="text-gray-400 hover:text-red-500 shrink-0 mt-2.5" title="Remove option"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
      </div>
      <button onClick={add} className="mt-2 text-xs font-semibold text-brand-600 inline-flex items-center gap-1 hover:underline"><Plus className="w-3.5 h-3.5" /> Add option</button>
    </div>
  )
}

function SentencesEditor({
  sentences, onChange,
}: {
  sentences: { jp?: string; romaji?: string }[]
  onChange: (s: any[]) => void
}) {
  function edit(i: number, field: string, val: string) {
    const next = sentences.map((s, j) => (j === i ? { ...s, [field]: val } : s))
    onChange(next)
  }
  function remove(i: number) { onChange(sentences.filter((_, j) => j !== i)) }
  function add() { onChange([...sentences, { jp: '', romaji: '' }]) }

  return (
    <div>
      <span className="text-[11px] font-semibold text-muted uppercase tracking-wide">Sentences</span>
      <div className="mt-1 space-y-2">
        {sentences.map((s, i) => (
          <div key={i} className="rounded-lg border border-gray-100 p-2.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-muted">#{i + 1}</span>
              <button onClick={() => remove(i)} className="text-gray-400 hover:text-red-500" title="Remove"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
            <input value={s.jp ?? ''} onChange={e => edit(i, 'jp', e.target.value)} placeholder="Japanese" className={inputCls} />
            <FuriganaPreview text={s.jp ?? ''} compact />
            <input value={s.romaji ?? ''} onChange={e => edit(i, 'romaji', e.target.value)} placeholder="Romaji" className={inputCls} />
          </div>
        ))}
      </div>
      <button onClick={add} className="mt-2 text-xs font-semibold text-brand-600 inline-flex items-center gap-1 hover:underline"><Plus className="w-3.5 h-3.5" /> Add sentence</button>
    </div>
  )
}
