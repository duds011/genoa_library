'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FolderSearch, CheckCircle2, AlertTriangle } from 'lucide-react'

type Status = 'idle' | 'loading' | 'success' | 'error'

interface DriveResult {
  processed?: number
  errors?: string[]
  message?: string
  partialError?: boolean
}

export default function CheckDriveButton() {
  const router = useRouter()
  const [status, setStatus] = useState<Status>('idle')
  const [result, setResult] = useState<DriveResult | null>(null)

  async function handleCheck() {
    setStatus('loading')
    setResult(null)

    try {
      const res = await fetch('/api/check-drive', { method: 'POST' })
      const data: DriveResult = await res.json()

      if (data.partialError) {
        setStatus('error')
        setResult(data)
      } else if (!res.ok) {
        setStatus('error')
        setResult({ message: data.message ?? 'Something went wrong' })
      } else {
        setStatus('success')
        setResult(data)
      }
    } catch {
      setStatus('error')
      setResult({ message: 'Could not reach the Drive scanner' })
    }
  }

  function handleClose() {
    if (status === 'success') {
      router.refresh()
    }
    setStatus('idle')
    setResult(null)
  }

  return (
    <>
      <button
        onClick={handleCheck}
        disabled={status === 'loading'}
        className="btn-ghost text-sm flex items-center gap-2 disabled:opacity-60"
      >
        <FolderSearch className="w-4 h-4" />
        Check for new recaps
      </button>

      {/* Modal overlay */}
      {status !== 'idle' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center">

            {/* Loading */}
            {status === 'loading' && (
              <>
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                  style={{ background: 'linear-gradient(135deg,#ede9fe,#ddd6fe)' }}>
                  <FolderSearch className="w-7 h-7 text-brand-600 animate-pulse" />
                </div>
                <h2 className="text-lg font-bold text-ink mb-2">Scanning Google Drive…</h2>
                <p className="text-sm text-muted">Please wait while we check for new lesson transcripts. This may take up to a minute.</p>
                <div className="mt-6 flex justify-center gap-1.5">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="w-2 h-2 rounded-full bg-brand-400 animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </>
            )}

            {/* Success */}
            {status === 'success' && (
              <>
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-green-50">
                  <CheckCircle2 className="w-8 h-8 text-green-500" />
                </div>
                <h2 className="text-lg font-bold text-ink mb-2">
                  {(result?.processed ?? 0) > 0
                    ? `${result!.processed} new lesson${result!.processed === 1 ? '' : 's'} imported!`
                    : 'No new files found'}
                </h2>
                <p className="text-sm text-muted mb-6">
                  {(result?.processed ?? 0) > 0
                    ? 'The page will refresh so you can review the new drafts.'
                    : 'All transcripts in Google Drive have already been processed.'}
                </p>
                {result?.errors && result.errors.length > 0 && (
                  <p className="text-xs text-orange-600 mb-4">
                    {result.errors.length} file{result.errors.length === 1 ? '' : 's'} skipped — check filename format.
                  </p>
                )}
                <button onClick={handleClose} className="btn-primary w-full justify-center">
                  {(result?.processed ?? 0) > 0 ? 'Show new lessons' : 'Close'}
                </button>
              </>
            )}

            {/* Error */}
            {status === 'error' && (
              <>
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-orange-50">
                  <AlertTriangle className="w-8 h-8 text-orange-400" />
                </div>
                <h2 className="text-lg font-bold text-ink mb-2">
                  {result?.partialError ? 'Imported with warnings' : 'Something went wrong'}
                </h2>
                <p className="text-sm text-muted mb-6">{result?.message}</p>
                <div className="flex flex-col gap-2">
                  {result?.partialError && (
                    <button onClick={() => { router.refresh(); setStatus('idle'); setResult(null) }} className="btn-primary w-full justify-center">
                      Refresh to see new lessons
                    </button>
                  )}
                  <button onClick={handleClose} className="btn-secondary w-full justify-center">
                    Close
                  </button>
                </div>
              </>
            )}

          </div>
        </div>
      )}
    </>
  )
}
