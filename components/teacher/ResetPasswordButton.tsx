'use client'

import { useState } from 'react'
import { KeyRound, Loader2, Eye, EyeOff } from 'lucide-react'
import { resetStudentPassword } from '@/app/actions/students'

interface Props {
  studentId: string
}

export default function ResetPasswordButton({ studentId }: Props) {
  const [state, setState] = useState<'idle' | 'form' | 'loading' | 'done' | 'error'>('idle')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters')
      return
    }
    setState('loading')
    const result = await resetStudentPassword(studentId, password)
    if (!result.success) {
      setErrorMsg(result.error || 'Failed')
      setState('error')
      return
    }
    setState('done')
  }

  function handleCancel() {
    setPassword('')
    setShowPassword(false)
    setErrorMsg('')
    setState('idle')
  }

  if (state === 'done') {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm space-y-1">
        <p className="font-semibold text-green-800">Password updated</p>
        <p className="font-mono text-ink font-bold select-all">{password}</p>
        <p className="text-xs text-green-600">Share this with the student.</p>
        <button className="text-xs text-green-700 underline mt-1" onClick={handleCancel}>
          Dismiss
        </button>
      </div>
    )
  }

  if (state === 'form' || state === 'loading' || state === 'error') {
    return (
      <form onSubmit={handleSubmit} className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 space-y-2">
        <p className="text-xs font-semibold text-ink">Set new password</p>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={e => { setPassword(e.target.value); setErrorMsg('') }}
            placeholder="New password"
            className="input w-full pr-9 text-sm"
            autoFocus
            disabled={state === 'loading'}
          />
          <button
            type="button"
            onClick={() => setShowPassword(v => !v)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        </div>
        {errorMsg && <p className="text-xs text-red-500">{errorMsg}</p>}
        <div className="flex items-center gap-2 pt-0.5">
          <button
            type="submit"
            disabled={state === 'loading' || !password}
            className="btn-primary text-xs flex items-center gap-1.5"
          >
            {state === 'loading' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {state === 'loading' ? 'Saving…' : 'Set Password'}
          </button>
          <button type="button" onClick={handleCancel} className="btn-ghost text-xs" disabled={state === 'loading'}>
            Cancel
          </button>
        </div>
      </form>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setState('form')}
      className="btn-secondary text-xs flex items-center gap-1.5"
    >
      <KeyRound className="w-3.5 h-3.5" />
      Reset Password
    </button>
  )
}
