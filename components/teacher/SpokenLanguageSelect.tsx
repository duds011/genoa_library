'use client'

import { useState } from 'react'
import { Languages, Check, Loader2 } from 'lucide-react'
import { SPOKEN_LANGUAGES } from '@/lib/languages'
import { updateStudentSpokenLanguage } from '@/app/actions/students'

/**
 * What this student's lessons are spoken in.
 *
 * The recorder used to ask on every lesson, in a dropdown beside the student
 * picker. It is not a per-lesson question: a beginner's hour is mostly English
 * whether you are asked once or fifty times. So it is answered here, on the
 * student, and the recorder and the transcriber both read it from the record.
 *
 * Saves on change — there is no Save button because there is nothing else on
 * this control to get wrong, and a setting you have to confirm is a setting
 * that stays stale.
 */
export default function SpokenLanguageSelect({
  studentId,
  current,
}: {
  studentId: string
  current?: string | null
}) {
  const [value, setValue] = useState(current || 'English')
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  // A language set before this list existed still has to show as itself.
  const options = SPOKEN_LANGUAGES.includes(value) ? SPOKEN_LANGUAGES : [value, ...SPOKEN_LANGUAGES]

  async function handleChange(next: string) {
    const previous = value
    setValue(next)
    setState('saving')
    const result = await updateStudentSpokenLanguage(studentId, next)
    if (!result.success) {
      setValue(previous)
      setState('error')
      return
    }
    setState('saved')
    setTimeout(() => setState((s) => (s === 'saved' ? 'idle' : s)), 2000)
  }

  return (
    <div className="flex items-center gap-2">
      <label className="flex items-center gap-1.5 text-xs text-muted" title="The language your lessons with this student are actually spoken in — what the recorder transcribes against. Not the language they are learning.">
        <Languages className="w-3.5 h-3.5" />
        Spoken in lessons
        <select
          className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 bg-white text-ink focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-60"
          value={value}
          disabled={state === 'saving'}
          onChange={(e) => handleChange(e.target.value)}
        >
          {options.map((l) => <option key={l}>{l}</option>)}
        </select>
      </label>
      {state === 'saving' && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted" />}
      {state === 'saved' && <Check className="w-3.5 h-3.5 text-green-600" />}
      {state === 'error' && <span className="text-xs text-red-600">Not saved — try again.</span>}
    </div>
  )
}
