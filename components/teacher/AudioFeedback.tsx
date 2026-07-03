'use client'

import { useState, useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import { sendAudioFeedback } from '@/app/actions/audioFeedback'
import TeacherFeedbackRecorder from '@/components/teacher/TeacherFeedbackRecorder'

export default function AudioFeedback({
  submissionId,
  initialFeedback,
  initialFeedbackAudioUrl,
}: {
  submissionId: string
  initialFeedback?: string | null
  initialFeedbackAudioUrl?: string | null
}) {
  const [feedback, setFeedback] = useState(initialFeedback ?? '')
  const [audioUrl, setAudioUrl] = useState<string | null>(initialFeedbackAudioUrl ?? null)
  const [sent, setSent] = useState(Boolean(initialFeedback || initialFeedbackAudioUrl))
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  function send() {
    if (!feedback.trim() && !audioUrl) { setError('Add text or audio feedback'); return }
    setError('')
    startTransition(async () => {
      const res = await sendAudioFeedback(submissionId, feedback, audioUrl)
      if (res.success) { setSent(true); setOpen(false) }
      else setError(res.error || 'Failed to send')
    })
  }

  if (!open) {
    return (
      <div className="mt-2">
        {sent && (feedback || audioUrl) && (
          <div className="mb-2 p-2.5 rounded-lg border border-green-100 bg-green-50">
            <p className="text-[10px] font-bold text-green-700 uppercase tracking-widest mb-0.5">Feedback sent</p>
            {feedback && <p className="text-xs text-ink whitespace-pre-line">{feedback}</p>}
            {audioUrl && <p className="text-[11px] text-green-700 mt-0.5">🎧 audio feedback attached</p>}
          </div>
        )}
        <button onClick={() => setOpen(true)} className="btn-ghost text-xs">
          {sent ? '✏️ Edit feedback' : '💬 Add feedback'}
        </button>
      </div>
    )
  }

  return (
    <div className="mt-2 space-y-2.5 p-3 rounded-lg bg-gray-50 border border-gray-100">
      <textarea
        className="textarea text-sm min-h-[60px]"
        placeholder="Text feedback (optional)…"
        value={feedback}
        onChange={e => setFeedback(e.target.value)}
        autoFocus
      />
      <div>
        <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5">Or record a voice note</p>
        <TeacherFeedbackRecorder
          pathPrefix={`feedback/${submissionId}`}
          existingUrl={audioUrl}
          onUploaded={setAudioUrl}
        />
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex items-center gap-2">
        <button onClick={send} disabled={pending || (!feedback.trim() && !audioUrl)} className="btn-primary text-xs">
          {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : '✉️'} Send
        </button>
        <button onClick={() => setOpen(false)} disabled={pending} className="btn-ghost text-xs">Cancel</button>
      </div>
    </div>
  )
}
