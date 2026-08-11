'use client'

/**
 * Rewriting one practice exercise during lesson review.
 *
 * Mirrors QuestionEditor (tests) in shape and styling, but the field names are
 * the exercise shapes the student's practice section actually reads, and there
 * is no furigana handling: that section renders these strings as plain text,
 * so bracket syntax would reach the student literally.
 */

import { useState } from 'react'
import { Loader2, Plus, Trash2, Save, X } from 'lucide-react'
import { createExercise, updateExercise } from '@/app/actions/exercises'

export type ExerciseType = 'read_aloud' | 'speak' | 'multiple_choice' | 'fill_blank'

export const TYPE_LABEL: Record<string, string> = {
  read_aloud: '🎙️ Read aloud',
  speak: '🎙️ Speaking',
  multiple_choice: '✅ Multiple choice',
  fill_blank: '✏️ Fill in the blank',
}

/** A blank of each type — same shapes the generator writes. */
export const BLANK: Record<ExerciseType, { prompt: string; data: any }> = {
  read_aloud: { prompt: 'Read these sentences aloud', data: { focus: '', sentences: [{ jp: '', en: '' }] } },
  speak: { prompt: 'Answer out loud', data: { prompt_jp: '', prompt_en: '', hint: '' } },
  multiple_choice: { prompt: 'Quick check', data: { question: '', options: ['', '', ''], answer: 0 } },
  fill_blank: { prompt: 'Fill in the blank', data: { before: '', after: '', options: ['', '', ''], answer: '', en: '' } },
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

export default function ExerciseEditor({
  exercise, lessonId, onDone, onCancel,
}: {
  /** The exercise being edited. An empty `id` means this one is being written. */
  exercise: { id: string; type: ExerciseType; prompt: string; data: any }
  lessonId: string
  onDone: () => void
  onCancel: () => void
}) {
  const { id, type } = exercise
  const [prompt, setPrompt] = useState(exercise.prompt ?? '')
  // Deep-clone so edits don't mutate the row until saved.
  const [data, setData] = useState<any>(() => JSON.parse(JSON.stringify(exercise.data ?? {})))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (field: string, value: any) => setData((d: any) => ({ ...d, [field]: value }))

  async function save() {
    setSaving(true); setError('')
    const res = id
      ? await updateExercise({ exerciseId: id, prompt, data })
      : await createExercise({ lessonId, type, prompt, data })
    setSaving(false)
    if (!res.success) { setError(res.error ?? 'Could not save.'); return }
    onDone()
  }

  return (
    <div className="mt-1 space-y-3">
      <Field label="Prompt / task shown to the student">
        <input value={prompt} onChange={e => setPrompt(e.target.value)} className={inputCls} />
      </Field>

      {type === 'read_aloud' && (
        <>
          <Field label="Focus">
            <input value={data.focus ?? ''} onChange={e => set('focus', e.target.value)} placeholder="What the sentences drill" className={inputCls} />
          </Field>
          <SentencesEditor sentences={data.sentences ?? []} onChange={s => set('sentences', s)} />
        </>
      )}

      {type === 'speak' && (
        <>
          <Field label="Question (Japanese)">
            <input value={data.prompt_jp ?? ''} onChange={e => set('prompt_jp', e.target.value)} className={inputCls} />
          </Field>
          <Field label="Meaning">
            <input value={data.prompt_en ?? ''} onChange={e => set('prompt_en', e.target.value)} className={inputCls} />
          </Field>
          <Field label="Hint">
            <input value={data.hint ?? ''} onChange={e => set('hint', e.target.value)} placeholder="Which grammar or words to use" className={inputCls} />
          </Field>
        </>
      )}

      {type === 'multiple_choice' && (
        <>
          <Field label="Question">
            <input value={data.question ?? ''} onChange={e => set('question', e.target.value)} className={inputCls} />
          </Field>
          <OptionsEditor
            options={data.options ?? []}
            correctIndex={typeof data.answer === 'number' ? data.answer : 0}
            onChange={(options, answer) => setData((d: any) => ({ ...d, options, answer }))}
          />
        </>
      )}

      {type === 'fill_blank' && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Text before blank">
              <input value={data.before ?? ''} onChange={e => set('before', e.target.value)} className={inputCls} />
            </Field>
            <Field label="Text after blank">
              <input value={data.after ?? ''} onChange={e => set('after', e.target.value)} className={inputCls} />
            </Field>
          </div>
          <Field label="Meaning">
            <input value={data.en ?? ''} onChange={e => set('en', e.target.value)} className={inputCls} />
          </Field>
          <FillOptionsEditor
            options={data.options ?? []}
            answer={data.answer ?? ''}
            onChange={(options, answer) => setData((d: any) => ({ ...d, options, answer }))}
          />
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
    // Dropping the correct option can't leave `answer` pointing past the end.
    let answer = correctIndex
    if (i === correctIndex) answer = 0
    else if (i < correctIndex) answer = correctIndex - 1
    onChange(next, Math.min(answer, Math.max(0, next.length - 1)))
  }

  return (
    <div>
      <span className="text-[11px] font-semibold text-muted uppercase tracking-wide">Options — select the correct one</span>
      <div className="mt-1 space-y-2">
        {options.map((o, i) => (
          <div key={i} className="flex items-center gap-2">
            <input type="radio" name="ex-correct" checked={i === correctIndex} onChange={() => onChange(options, i)} className="accent-brand-600 w-4 h-4 shrink-0" title="Mark correct" />
            <input value={o} onChange={e => edit(i, e.target.value)} className={`${inputCls} flex-1`} />
            <button onClick={() => remove(i)} className="text-gray-400 hover:text-red-500 shrink-0" title="Remove option"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
      </div>
      <button onClick={() => onChange([...options, ''], correctIndex)} className="mt-2 text-xs font-semibold text-brand-600 inline-flex items-center gap-1 hover:underline">
        <Plus className="w-3.5 h-3.5" /> Add option
      </button>
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
    // Retyping the correct option keeps it correct — the student's answer is
    // matched against this string, so the two must not drift apart.
    onChange(next, answer === prev ? val : answer)
  }
  function remove(i: number) {
    const next = options.filter((_, j) => j !== i)
    onChange(next, answer === options[i] ? (next[0] ?? '') : answer)
  }

  return (
    <div>
      <span className="text-[11px] font-semibold text-muted uppercase tracking-wide">Options — select the word that goes in the blank</span>
      <div className="mt-1 space-y-2">
        {options.map((o, i) => (
          <div key={i} className="flex items-center gap-2">
            <input type="radio" name="ex-fillcorrect" checked={o !== '' && o === answer} onChange={() => onChange(options, o)} className="accent-brand-600 w-4 h-4 shrink-0" title="Mark correct" />
            <input value={o} onChange={e => edit(i, e.target.value)} className={`${inputCls} flex-1`} />
            <button onClick={() => remove(i)} className="text-gray-400 hover:text-red-500 shrink-0" title="Remove option"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
      </div>
      <button onClick={() => onChange([...options, ''], answer)} className="mt-2 text-xs font-semibold text-brand-600 inline-flex items-center gap-1 hover:underline">
        <Plus className="w-3.5 h-3.5" /> Add option
      </button>
    </div>
  )
}

function SentencesEditor({
  sentences, onChange,
}: {
  sentences: { jp?: string; en?: string }[]
  onChange: (s: any[]) => void
}) {
  const edit = (i: number, field: string, val: string) =>
    onChange(sentences.map((s, j) => (j === i ? { ...s, [field]: val } : s)))

  return (
    <div>
      <span className="text-[11px] font-semibold text-muted uppercase tracking-wide">Sentences</span>
      <div className="mt-1 space-y-2">
        {sentences.map((s, i) => (
          <div key={i} className="rounded-lg border border-gray-100 p-2.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-muted">#{i + 1}</span>
              <button onClick={() => onChange(sentences.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500" title="Remove"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
            <input value={s.jp ?? ''} onChange={e => edit(i, 'jp', e.target.value)} placeholder="Japanese" className={inputCls} />
            <input value={s.en ?? ''} onChange={e => edit(i, 'en', e.target.value)} placeholder="Meaning" className={inputCls} />
          </div>
        ))}
      </div>
      <button onClick={() => onChange([...sentences, { jp: '', en: '' }])} className="mt-2 text-xs font-semibold text-brand-600 inline-flex items-center gap-1 hover:underline">
        <Plus className="w-3.5 h-3.5" /> Add sentence
      </button>
    </div>
  )
}
