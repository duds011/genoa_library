'use client'

import { useState } from 'react'
import { Mail, Pencil, Loader2, Check, X } from 'lucide-react'
import { updateStudentEmail } from '@/app/actions/students'

interface Props {
  studentId: string
  currentEmail: string
}

export default function UpdateEmailButton({ studentId, currentEmail }: Props) {
  const [state, setState] = useState<'idle' | 'editing' | 'loading' | 'done' | 'error'>('idle')
  const [newEmail, setNewEmail] = useState(currentEmail)
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSave() {
    const trimmed = newEmail.trim()
    if (!trimmed || trimmed === currentEmail) {
      setState('idle')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setErrorMsg('Invalid email address')
      setState('error')
      return
    }
    setState('loading')
    const result = await updateStudentEmail(studentId, trimmed)
    if (!result.success) {
      setErrorMsg(result.error || 'Failed to update email')
      setState('error')
      return
    }
    setState('done')
  }

  function handleCancel() {
    setNewEmail(currentEmail)
    setState('idle')
  }

  if (state === 'done') {
    return (
      <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2 text-sm">
        <Check className="w-3.5 h-3.5 text-green-600 shrink-0" />
        <span className="text-green-800 font-medium">Email updated to <span className="font-mono">{newEmail.trim()}</span></span>
        <button className="text-xs text-green-700 underline ml-1" onClick={() => setState('idle')}>
          Dismiss
        </button>
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2">
        {errorMsg}
        <button className="ml-2 underline text-xs" onClick={() => { setNewEmail(currentEmail); setState('idle') }}>
          Retry
        </button>
      </div>
    )
  }

  if (state === 'editing' || state === 'loading') {
    return (
      <div className="flex items-center gap-2">
        <div className="relative">
          <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
          <input
            type="email"
            value={newEmail}
            onChange={e => setNewEmail(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') handleCancel() }}
            disabled={state === 'loading'}
            autoFocus
            className="pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 w-64 disabled:opacity-60"
            placeholder="new@email.com"
          />
        </div>
        <button
          onClick={handleSave}
          disabled={state === 'loading'}
          className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1"
        >
          {state === 'loading'
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <Check className="w-3.5 h-3.5" />}
          {state === 'loading' ? 'Saving…' : 'Save'}
        </button>
        <button
          onClick={handleCancel}
          disabled={state === 'loading'}
          className="btn-ghost text-xs px-2 py-1.5"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    )
  }

  // idle
  return (
    <button
      type="button"
      onClick={() => setState('editing')}
      className="btn-secondary text-xs flex items-center gap-1.5"
    >
      <Mail className="w-3.5 h-3.5" />
      Change Email
    </button>
  )
}
