'use client'

import { useState } from 'react'
import { KeyRound, Loader2 } from 'lucide-react'
import { resetStudentPassword } from '@/app/actions/students'

interface Props {
  studentId: string
}

export default function ResetPasswordButton({ studentId }: Props) {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [newPassword, setNewPassword] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleReset() {
    if (!confirm('Generate a new temporary password for this student?')) return
    setState('loading')

    const result = await resetStudentPassword(studentId)
    if (!result.success) {
      setErrorMsg(result.error || 'Failed')
      setState('error')
      return
    }

    setNewPassword(result.newPassword ?? '')
    setState('done')
  }

  if (state === 'done') {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm space-y-1">
        <p className="font-semibold text-amber-800">New password set</p>
        <p className="font-mono text-ink font-bold select-all">{newPassword}</p>
        <p className="text-xs text-amber-600">Share this with the student. It&apos;s shown only once.</p>
        <button className="text-xs text-amber-700 underline mt-1" onClick={() => setState('idle')}>
          Dismiss
        </button>
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2">
        {errorMsg}
        <button className="ml-2 underline text-xs" onClick={() => setState('idle')}>Retry</button>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={handleReset}
      disabled={state === 'loading'}
      className="btn-secondary text-xs flex items-center gap-1.5"
    >
      {state === 'loading'
        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
        : <KeyRound className="w-3.5 h-3.5" />
      }
      {state === 'loading' ? 'Resetting…' : 'Reset Password'}
    </button>
  )
}
