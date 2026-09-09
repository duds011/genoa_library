'use client'

import { useState, useTransition } from 'react'
import { Loader2, Mic } from 'lucide-react'
import { sendAudioFeedback } from '@/app/actions/audioFeedback'
import TeacherFeedbackRecorder from '@/components/teacher/TeacherFeedbackRecorder'
import RecordedAudio from '@/components/RecordedAudio'

/**
 * The teacher's reply to one student recording.
 *
 * Voice leads, because that is how she actually answers these — every reply
 * sent so far has been audio with no text at all. The written note stays as
 * the optional second half.
 */
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
    if (!feedback.trim() && !audioUrl) { setError('Record a voice note or write something first.'); return }
    setError('')
    startTransition(async () => {
      const res = await sendAudioFeedback(submissionId, feedback, audioUrl)
      if (res.success) { setSent(true); setOpen(false) }
      else {
        console.error('sendAudioFeedback failed', res.error)
        setError('That reply did not send. Try again in a moment.')
      }
    })
  }

  if (!open) {
    return (
      <div className="mt-2">
        {sent && (feedback || audioUrl) && (
          <div className="mb-2 p-3 rounded-lg border border-green-100 bg-green-50">
            <p className="text-[10px] font-bold text-green-700 uppercase tracking-widest mb-1.5">Your reply — sent</p>
            {audioUrl && <RecordedAudio src={audioUrl} className="w-full h-9" />}
            {feedback && <p className="text-xs text-ink whitespace-pre-line mt-1.5">{feedback}</p>}
          </div>
        )}
        <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-brand-600 text-white text-xs font-semibold hover:bg-brand-700">
          <Mic className="w-3.5 h-3.5" />
          {sent ? 'Change your reply' : 'Reply with a voice note'}
        </button>
      </div>
    )
  }

  return (
    <div className="mt-2 space-y-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
      <div>
        <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5">Voice reply</p>
        <TeacherFeedbackRecorder
          pathPrefix={`feedback/${submissionId}`}
          existingUrl={audioUrl}
          onUploaded={setAudioUrl}
        />
      </div>
      <div>
        <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5">Written note <span className="normal-case tracking-normal font-normal text-gray-400">(optional)</span></p>
        <textarea
          className="textarea text-sm min-h-[60px]"
          placeholder="Anything you want them to read alongside it…"
          value={feedback}
          onChange={e => setFeedback(e.target.value)}
        />
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex items-center gap-2">
        <button onClick={send} disabled={pending || (!feedback.trim() && !audioUrl)} className="btn-primary text-xs disabled:opacity-50">
          {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : '✉️'} Send to student
        </button>
        <button onClick={() => setOpen(false)} disabled={pending} className="btn-ghost text-xs">Cancel</button>
      </div>
    </div>
  )
}
