'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CheckCircle, Loader2 } from 'lucide-react'
import { createAuthForExistingStudent } from '@/app/actions/students'

interface Props {
  studentId: string
  studentName: string
}

export default function SetupStudentLoginButton({ studentId, studentName }: Props) {
  const router = useRouter()
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [tempPassword, setTempPassword] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSetup(e: React.MouseEvent) {
    e.preventDefault()   // prevent Link navigation
    e.stopPropagation()
    setState('loading')

    const result = await createAuthForExistingStudent(studentId)
    if (!result.success) {
      setErrorMsg(result.error || 'Failed')
      setState('error')
      return
    }

    setTempPassword(result.tempPassword ?? '')
    setState('done')
    // Don't refresh yet — let teacher read the credentials first
  }

  if (state === 'done') {
    return (
      <div
        onClick={e => e.stopPropagation()}
        className="text-xs text-green-800 bg-green-50 border border-green-200 rounded-xl px-4 py-3 space-y-2"
      >
        <p className="flex items-center gap-1.5 font-semibold text-sm">
          <CheckCircle className="w-4 h-4 shrink-0 text-green-600" />
          Login created for {studentName}!
        </p>
        {tempPassword && (
          <div className="font-mono bg-white border border-green-100 rounded-lg px-3 py-2 space-y-0.5">
            <p className="text-muted">Email: <span className="text-ink font-medium">{studentName.toLowerCase().replace(' ', '.')}@...</span></p>
            <p className="text-muted">Password: <span className="text-ink font-semibold select-all">{tempPassword}</span></p>
          </div>
        )}
        <p className="text-green-600">Share this with the student — they can log in now.</p>
        <button
          type="button"
          className="btn-secondary text-xs py-1.5 px-3"
          onClick={() => router.refresh()}
        >
          ✓ Done, I&apos;ve noted it
        </button>
      </div>
    )
  }

  if (state === 'error') {
    return (
      <span
        onClick={e => e.stopPropagation()}
        className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-2 py-1"
      >
        {errorMsg}
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={handleSetup}
      disabled={state === 'loading'}
      className="flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 rounded-lg px-2.5 py-1.5 transition-colors"
    >
      {state === 'loading' ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <AlertTriangle className="w-3.5 h-3.5" />
      )}
      {state === 'loading' ? 'Creating…' : 'No login — set up'}
    </button>
  )
}
