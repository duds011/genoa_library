'use client'

import { useState } from 'react'
import { Loader2, Plus, Trash2, Save, X } from 'lucide-react'
import { updateTestQuestion } from '@/app/actions/tests'
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

  return (
    <div className="mt-1 space-y-3">
      <Field label="Prompt / task shown to the student">
        <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={2} className={inputCls} />
      </Field>

      {q.type !== 'reading_passage' && (
        <Field label="Points">
          <input type="number" min={0} value={points} onChange={e => setPoints(Number(e.target.value))} className={`${inputCls} w-24`} />
        </Field>
      )}

      {q.type === 'speak' && (
        <>
          <Field label="Japanese (prompt_jp)"><input value={data.prompt_jp ?? ''} onChange={e => set('prompt_jp', e.target.value)} className={inputCls} /></Field>
          <Field label="Romaji (prompt_romaji)"><input value={data.prompt_romaji ?? ''} onChange={e => set('prompt_romaji', e.target.value)} className={inputCls} /></Field>
          <Field label="Hint"><input value={data.hint ?? ''} onChange={e => set('hint', e.target.value)} className={inputCls} /></Field>
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
          <Field label="Passage (Japanese)"><textarea value={data.text ?? ''} onChange={e => set('text', e.target.value)} rows={3} className={inputCls} /></Field>
          <Field label="Romaji reading"><textarea value={data.romaji ?? ''} onChange={e => set('romaji', e.target.value)} rows={2} className={inputCls} /></Field>
          <Field label="English translation"><textarea value={data.translation ?? ''} onChange={e => set('translation', e.target.value)} rows={2} className={inputCls} /></Field>
        </>
      )}

      {q.type === 'multiple_choice' && (
        <>
          <Field label="Question"><input value={data.question ?? ''} onChange={e => set('question', e.target.value)} className={inputCls} /></Field>
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
            <Field label="Text before blank"><input value={data.before ?? ''} onChange={e => set('before', e.target.value)} className={inputCls} /></Field>
            <Field label="Text after blank"><input value={data.after ?? ''} onChange={e => set('after', e.target.value)} className={inputCls} /></Field>
          </div>
          <Field label="English"><input value={data.en ?? ''} onChange={e => set('en', e.target.value)} className={inputCls} /></Field>
          <FillOptionsEditor
            options={data.options ?? []}
            answer={data.answer ?? ''}
            onChange={(opts, answer) => setData((d: any) => ({ ...d, options: opts, answer }))}
          />
        </>
      )}

      {q.type === 'written' && (
        <>
          <Field label="Context (optional)"><textarea value={data.context ?? ''} onChange={e => set('context', e.target.value)} rows={2} className={inputCls} /></Field>
          <Field label="Model answer (for your grading)"><textarea value={data.reference_answer ?? ''} onChange={e => set('reference_answer', e.target.value)} rows={2} className={inputCls} /></Field>
          <Field label="Grading note (optional)"><input value={data.guidance ?? ''} onChange={e => set('guidance', e.target.value)} className={inputCls} /></Field>
        </>
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
          <div key={i} className="flex items-center gap-2">
            <input type="radio" name="correct" checked={i === correctIndex} onChange={() => onChange(options, i)} className="accent-brand-600 w-4 h-4 shrink-0" title="Mark correct" />
            <input value={o} onChange={e => edit(i, e.target.value)} className={inputCls} />
            <button onClick={() => remove(i)} className="text-gray-400 hover:text-red-500 shrink-0" title="Remove option"><Trash2 className="w-4 h-4" /></button>
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
          <div key={i} className="flex items-center gap-2">
            <input type="radio" name="fillcorrect" checked={o !== '' && o === answer} onChange={() => onChange(options, o)} className="accent-brand-600 w-4 h-4 shrink-0" title="Mark correct" />
            <input value={o} onChange={e => edit(i, e.target.value)} className={inputCls} />
            <button onClick={() => remove(i)} className="text-gray-400 hover:text-red-500 shrink-0" title="Remove option"><Trash2 className="w-4 h-4" /></button>
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
  sentences: { jp?: string; romaji?: string; en?: string }[]
  onChange: (s: any[]) => void
}) {
  function edit(i: number, field: string, val: string) {
    const next = sentences.map((s, j) => (j === i ? { ...s, [field]: val } : s))
    onChange(next)
  }
  function remove(i: number) { onChange(sentences.filter((_, j) => j !== i)) }
  function add() { onChange([...sentences, { jp: '', romaji: '', en: '' }]) }

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
            <input value={s.romaji ?? ''} onChange={e => edit(i, 'romaji', e.target.value)} placeholder="Romaji" className={inputCls} />
            <input value={s.en ?? ''} onChange={e => edit(i, 'en', e.target.value)} placeholder="English" className={inputCls} />
          </div>
        ))}
      </div>
      <button onClick={add} className="mt-2 text-xs font-semibold text-brand-600 inline-flex items-center gap-1 hover:underline"><Plus className="w-3.5 h-3.5" /> Add sentence</button>
    </div>
  )
}
