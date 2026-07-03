'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Mic, Square, Play, Pause, RotateCcw, Loader2, Send, Trash2 } from 'lucide-react'

export interface AudioSub {
  id: string
  audio_url: string
  file_name: string
  teacher_feedback?: string | null
  feedback_audio_url?: string | null
}

// iOS Safari can't record audio/webm — pick a format the browser supports.
function pickRecordingType(): string {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return ''
  for (const t of ['audio/webm', 'audio/mp4', 'audio/ogg']) {
    if (MediaRecorder.isTypeSupported(t)) return t
  }
  return ''
}

function extForType(type: string): string {
  if (type.includes('mp4')) return 'm4a'
  if (type.includes('ogg')) return 'ogg'
  return 'webm'
}

export default function ExerciseAudioRecorder({
  lessonId,
  studentId,
  exerciseId,
  initial,
}: {
  lessonId: string
  studentId: string
  exerciseId: string
  initial?: AudioSub
}) {
  const supabase = createClient()
  const [submission, setSubmission] = useState<AudioSub | undefined>(initial)
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [error, setError] = useState('')

  // Recorded but not yet sent — student can listen first.
  const [pending, setPending] = useState<{ url: string; file: File } | null>(null)

  const recRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  function discardPending() {
    setPending(prev => {
      if (prev) URL.revokeObjectURL(prev.url)
      return null
    })
  }

  async function sendPending() {
    if (!pending) return
    setUploading(true); setError('')
    try {
      const ext = pending.file.name.split('.').pop() ?? 'webm'
      const path = `${lessonId}/ex-${exerciseId}-${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('student-audio').upload(path, pending.file)
      if (upErr) { setError(`Upload failed: ${upErr.message}`); return }
      const { data: { publicUrl } } = supabase.storage.from('student-audio').getPublicUrl(path)
      const { data, error: insErr } = await supabase
        .from('student_audio_submissions')
        .insert({ lesson_id: lessonId, student_id: studentId, exercise_id: exerciseId, audio_url: publicUrl, file_name: pending.file.name })
        .select()
        .single()
      if (insErr) { setError(`Could not save your recording: ${insErr.message}`); return }
      if (data) {
        setSubmission(data as AudioSub)
        audioRef.current = null; setPlaying(false)
        discardPending()
      }
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong sending your recording.')
    } finally {
      setUploading(false)
    }
  }

  async function start() {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mime = pickRecordingType()
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      chunksRef.current = []
      rec.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      rec.onstop = () => {
        stream.getTracks().forEach(t => t.stop())
        const type = rec.mimeType || mime || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type })
        const file = new File([blob], `recording-${Date.now()}.${extForType(type)}`, { type })
        setPending({ url: URL.createObjectURL(file), file })
      }
      rec.start(1000)
      recRef.current = rec
      setRecording(true); setSeconds(0)
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000)
    } catch (e: any) {
      if (e?.name === 'NotAllowedError' || e?.name === 'SecurityError') {
        setError('Microphone access denied.')
      } else {
        setError('Recording is not supported on this browser.')
      }
    }
  }

  function stop() {
    recRef.current?.stop()
    if (timerRef.current) clearInterval(timerRef.current)
    setRecording(false); setSeconds(0)
  }

  function togglePlay() {
    if (!submission) return
    if (playing) { audioRef.current?.pause(); setPlaying(false); return }
    if (!audioRef.current) {
      audioRef.current = new Audio(submission.audio_url)
      audioRef.current.onended = () => setPlaying(false)
    }
    audioRef.current.play(); setPlaying(true)
  }

  async function reRecord() {
    if (submission) {
      const path = submission.audio_url.split('/student-audio/')[1]
      if (path) await supabase.storage.from('student-audio').remove([decodeURIComponent(path)])
      await supabase.from('student_audio_submissions').delete().eq('id', submission.id)
      setSubmission(undefined)
      audioRef.current = null; setPlaying(false)
    }
    start()
  }

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  return (
    <div className="mt-3">
      {pending ? (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 space-y-2.5">
          <p className="text-xs font-semibold text-amber-700">🎧 Listen back, then send it.</p>
          <audio controls src={pending.url} className="w-full h-9" />
          <div className="flex items-center gap-2">
            <button
              onClick={sendPending}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-brand-600 text-white text-xs font-semibold hover:bg-brand-700 disabled:opacity-50"
            >
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              {uploading ? 'Sending…' : 'Send'}
            </button>
            <button
              onClick={discardPending}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-ink disabled:opacity-50"
            >
              <Trash2 className="w-3 h-3" /> Discard
            </button>
          </div>
        </div>
      ) : submission ? (
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={togglePlay} className="w-8 h-8 rounded-full bg-brand-600 text-white flex items-center justify-center hover:bg-brand-700">
            {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
          </button>
          <span className="text-xs font-semibold text-green-600">✓ Recorded</span>
          <button onClick={reRecord} disabled={uploading} className="text-xs text-muted hover:text-ink inline-flex items-center gap-1">
            <RotateCcw className="w-3 h-3" /> Re-record
          </button>
        </div>
      ) : recording ? (
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-red-600">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> {fmt(seconds)}
          </span>
          <button onClick={stop} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500 text-white text-xs font-semibold hover:bg-red-600">
            <Square className="w-3 h-3" /> Stop
          </button>
        </div>
      ) : (
        <button onClick={start} disabled={uploading} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-brand-600 text-white text-xs font-semibold hover:bg-brand-700 disabled:opacity-50">
          <Mic className="w-3.5 h-3.5" />
          Record answer
        </button>
      )}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}

      {(submission?.teacher_feedback || submission?.feedback_audio_url) && (
        <div className="mt-2.5 p-3 rounded-lg border border-brand-200 bg-brand-50">
          <p className="text-[10px] font-bold text-brand-600 uppercase tracking-widest mb-1">Noa Feedback</p>
          {submission?.teacher_feedback && <p className="text-sm text-ink whitespace-pre-line">{submission.teacher_feedback}</p>}
          {submission?.feedback_audio_url && <audio controls src={submission.feedback_audio_url} className="w-full h-9 mt-2" />}
        </div>
      )}
    </div>
  )
}
