'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Mic, Square, RotateCcw, Loader2, Upload, Check, Trash2 } from 'lucide-react'
import RecordedAudio from '@/components/RecordedAudio'
import { newRecorder, fileFromChunks, contentTypeFor } from '@/lib/audioRecording'

/**
 * Records or uploads a voice note, lets the teacher hear it back, and only
 * then puts it in the student-audio bucket and hands the URL up.
 *
 * It used to upload the moment recording stopped, with no way to hear what had
 * been captured — so a clip Safari had made in MP4 but the code had labelled
 * WebM went out unheard and unplayable. Now nothing leaves the browser until
 * she has listened to it. See lib/audioRecording.ts for the format rule.
 */
export default function TeacherFeedbackRecorder({
  pathPrefix,
  existingUrl,
  onUploaded,
}: {
  pathPrefix: string                 // e.g. `feedback/<lessonId>`
  existingUrl?: string | null
  onUploaded: (url: string) => void
}) {
  const supabase = createClient()
  const [url, setUrl] = useState<string | null>(existingUrl ?? null)
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  // Recorded or chosen, heard by nobody yet. Held as a local blob URL so she
  // can play it before it becomes the student's copy.
  const [pending, setPending] = useState<{ url: string; file: File } | null>(null)

  const recRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current) }, [])

  function stage(file: File) {
    setError('')
    setPending(prev => {
      if (prev) URL.revokeObjectURL(prev.url)
      return { url: URL.createObjectURL(file), file }
    })
  }

  function discard() {
    setPending(prev => {
      if (prev) URL.revokeObjectURL(prev.url)
      return null
    })
  }

  async function keep() {
    if (!pending) return
    setUploading(true); setError('')
    try {
      const ext = pending.file.name.split('.').pop() ?? 'webm'
      const path = `${pathPrefix}-${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('student-audio')
        .upload(path, pending.file, { contentType: contentTypeFor(pending.file) })
      if (upErr) {
        console.error('Voice note upload failed', upErr)
        setError('That voice note did not save. Check your connection and try again.')
        return
      }
      const { data: { publicUrl } } = supabase.storage.from('student-audio').getPublicUrl(path)
      setUrl(publicUrl)
      discard()
      onUploaded(publicUrl)
    } catch (e) {
      console.error('Voice note upload failed', e)
      setError('Something went wrong saving that voice note. Try again.')
    } finally {
      setUploading(false)
    }
  }

  async function start() {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const rec = newRecorder(stream)
      chunksRef.current = []
      rec.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      rec.onstop = () => {
        stream.getTracks().forEach(t => t.stop())
        const file = fileFromChunks(chunksRef.current, rec, `fb-${Date.now()}`)
        if (!file) { setError('That recording came out empty — try again, and give it a second before stopping.'); return }
        stage(file)
      }
      rec.start(1000)
      recRef.current = rec
      setRecording(true); setSeconds(0)
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000)
    } catch (e: any) {
      console.error('Could not start recording', e)
      if (e?.name === 'NotAllowedError' || e?.name === 'SecurityError') {
        setError('Microphone access is blocked. Allow it for this site and try again.')
      } else {
        setError('This browser will not record audio. Use the Upload button instead.')
      }
    }
  }

  function stop() {
    recRef.current?.stop()
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    setRecording(false); setSeconds(0)
  }

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  // ── Listen back before it goes anywhere ───────────────────────────────────
  if (pending) {
    return (
      <div className="space-y-2.5">
        <p className="text-xs font-semibold text-brand-700">Listen to it first — the student hears exactly this.</p>
        <RecordedAudio src={pending.url} className="w-full h-9" />
        <div className="flex items-center gap-2 flex-wrap">
          <button type="button" onClick={keep} disabled={uploading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-brand-600 text-white text-xs font-semibold hover:bg-brand-700 disabled:opacity-50">
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            {uploading ? 'Saving…' : 'Use this one'}
          </button>
          <button type="button" onClick={() => { discard(); start() }} disabled={uploading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-brand-200 bg-brand-50 text-brand-600 text-xs font-semibold hover:bg-brand-100 disabled:opacity-50">
            <RotateCcw className="w-3.5 h-3.5" /> Record again
          </button>
          <button type="button" onClick={discard} disabled={uploading}
            className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-ink disabled:opacity-50">
            <Trash2 className="w-3 h-3" /> Discard
          </button>
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    )
  }

  // ── Recording ─────────────────────────────────────────────────────────────
  if (recording) {
    return (
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-red-600">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> {fmt(seconds)}
        </span>
        <button type="button" onClick={stop}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500 text-white text-xs font-semibold hover:bg-red-600">
          <Square className="w-3 h-3" /> Stop
        </button>
      </div>
    )
  }

  // ── Idle, with or without a saved clip ────────────────────────────────────
  return (
    <div className="space-y-2">
      {url && <RecordedAudio src={url} className="w-full h-9" />}
      <div className="flex items-center gap-2 flex-wrap">
        <button type="button" onClick={start} disabled={uploading}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-brand-600 text-white text-xs font-semibold hover:bg-brand-700 disabled:opacity-50">
          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : (url ? <RotateCcw className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />)}
          {uploading ? 'Saving…' : url ? 'Record a new one' : 'Record a voice note'}
        </button>
        <label className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-muted text-xs font-semibold cursor-pointer hover:bg-gray-50 ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
          <Upload className="w-3.5 h-3.5" /> Upload
          <input type="file" accept="audio/*" className="sr-only" disabled={uploading}
            onChange={e => { if (e.target.files?.[0]) { stage(e.target.files[0]); e.target.value = '' } }} />
        </label>
        {url && <span className="text-xs font-semibold text-green-600">Voice note attached</span>}
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
