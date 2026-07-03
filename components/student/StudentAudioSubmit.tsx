'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Mic, Upload, X, Play, Pause, Square, Send, Trash2 } from 'lucide-react'

interface Submission {
  id: string
  file_name: string
  audio_url: string
  created_at: string
  teacher_feedback?: string | null
  feedback_audio_url?: string | null
}

interface Props {
  lessonId: string
  studentId: string
  initialSubmissions: Submission[]
}

// Pick a recording format the current browser actually supports.
// iOS Safari does NOT support audio/webm — it needs mp4/mp4a — so hardcoding
// webm made recording throw there (surfacing as a false "mic denied" error).
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

export default function StudentAudioSubmit({ lessonId, studentId, initialSubmissions }: Props) {
  const supabase = createClient()
  const [submissions, setSubmissions] = useState<Submission[]>(initialSubmissions)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  // Recording state
  const [recording, setRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // Pending clip — recorded/selected but not yet sent to the teacher.
  // Held locally so the student can listen before committing.
  const [pending, setPending] = useState<{ url: string; file: File } | null>(null)

  // Playback state (for already-submitted recordings)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({})

  function stagePending(file: File) {
    setError('')
    setPending(prev => {
      if (prev) URL.revokeObjectURL(prev.url)
      return { url: URL.createObjectURL(file), file }
    })
  }

  function discardPending() {
    setPending(prev => {
      if (prev) URL.revokeObjectURL(prev.url)
      return null
    })
  }

  async function sendPending() {
    if (!pending) return
    setUploading(true)
    setError('')
    try {
      const fileName = pending.file.name
      const ext = fileName.split('.').pop() ?? 'webm'
      const path = `${lessonId}/${Date.now()}.${ext}`

      const { error: upErr } = await supabase.storage
        .from('student-audio')
        .upload(path, pending.file)
      if (upErr) { setError(`Upload failed: ${upErr.message}`); return }

      const { data: { publicUrl } } = supabase.storage
        .from('student-audio')
        .getPublicUrl(path)

      const { data, error: insErr } = await supabase
        .from('student_audio_submissions')
        .insert({ lesson_id: lessonId, student_id: studentId, audio_url: publicUrl, file_name: fileName })
        .select()
        .single()

      if (insErr) { setError(`Could not save your recording: ${insErr.message}`); return }
      if (data) {
        setSubmissions(prev => [...prev, data as Submission])
        discardPending()
      }
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong sending your recording.')
    } finally {
      setUploading(false)
    }
  }

  async function startRecording() {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mime = pickRecordingType()
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      chunksRef.current = []
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop())
        const type = recorder.mimeType || mime || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type })
        const file = new File([blob], `recording-${Date.now()}.${extForType(type)}`, { type })
        stagePending(file)
      }
      recorder.start(1000) // flush data every second — prevents 15s cap on some browsers
      mediaRecorderRef.current = recorder
      setRecording(true)
      setRecordingSeconds(0)
      timerRef.current = setInterval(() => setRecordingSeconds(s => s + 1), 1000)
    } catch (e: any) {
      // Distinguish a real permission denial from an unsupported-recorder error.
      if (e?.name === 'NotAllowedError' || e?.name === 'SecurityError') {
        setError('Microphone access denied. Please allow microphone access and try again.')
      } else {
        setError('Recording is not supported on this browser. Try updating it, or use "Upload file" instead.')
      }
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop()
    if (timerRef.current) clearInterval(timerRef.current)
    setRecording(false)
    setRecordingSeconds(0)
  }

  async function removeSubmission(id: string, audioUrl: string) {
    const path = audioUrl.split('/student-audio/')[1]
    if (path) await supabase.storage.from('student-audio').remove([decodeURIComponent(path)])
    await supabase.from('student_audio_submissions').delete().eq('id', id)
    setSubmissions(prev => prev.filter(s => s.id !== id))
    if (playingId === id) setPlayingId(null)
  }

  function togglePlay(id: string, url: string) {
    if (playingId === id) {
      audioRefs.current[id]?.pause()
      setPlayingId(null)
    } else {
      if (playingId && audioRefs.current[playingId]) {
        audioRefs.current[playingId].pause()
      }
      if (!audioRefs.current[id]) {
        const audio = new Audio(url)
        audio.onended = () => setPlayingId(null)
        audioRefs.current[id] = audio
      }
      audioRefs.current[id].play()
      setPlayingId(id)
    }
  }

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  return (
    <div className="card p-6 space-y-4">
      <div>
        <h2 className="section-title mb-1">🎙️ Practice Recording</h2>
        <p className="text-xs text-muted">
          Record yourself speaking Japanese — a question, a sentence you want to try, anything.
          Your teacher will listen before your next lesson.
        </p>
      </div>

      {/* Existing submissions */}
      {submissions.length > 0 && (
        <div className="space-y-2">
          {submissions.map(s => (
            <div key={s.id} className="rounded-xl bg-indigo-50 border border-indigo-100 p-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => togglePlay(s.id, s.audio_url)}
                  className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-white shrink-0 hover:bg-brand-700 transition-colors"
                >
                  {playingId === s.id
                    ? <Pause className="w-3.5 h-3.5" />
                    : <Play className="w-3.5 h-3.5 ml-0.5" />}
                </button>
                <span className="text-sm font-medium text-brand-700 flex-1 truncate">{s.file_name}</span>
                <button
                  onClick={() => removeSubmission(s.id, s.audio_url)}
                  className="text-gray-300 hover:text-red-400 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              {(s.teacher_feedback || s.feedback_audio_url) && (
                <div className="mt-2.5 p-3 rounded-lg border border-brand-200 bg-white">
                  <p className="text-[10px] font-bold text-brand-600 uppercase tracking-widest mb-1">Noa Feedback</p>
                  {s.teacher_feedback && <p className="text-sm text-ink whitespace-pre-line">{s.teacher_feedback}</p>}
                  {s.feedback_audio_url && <audio controls src={s.feedback_audio_url} className="w-full h-9 mt-2" />}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pending clip — listen before sending to the teacher */}
      {pending && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 space-y-3">
          <p className="text-xs font-semibold text-amber-700">
            🎧 Have a listen. Send it to your teacher when you&apos;re happy with it.
          </p>
          <audio controls src={pending.url} className="w-full h-9" />
          <div className="flex gap-2">
            <button
              onClick={sendPending}
              disabled={uploading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 transition-colors disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              {uploading ? 'Sending…' : 'Send to teacher'}
            </button>
            <button
              onClick={discardPending}
              disabled={uploading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white text-gray-500 text-sm font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              Discard
            </button>
          </div>
        </div>
      )}

      {/* Recording controls — hidden while reviewing a pending clip */}
      {!pending && (recording ? (
        <div className="flex items-center gap-4 p-4 rounded-xl bg-red-50 border border-red-100">
          <span className="flex items-center gap-2 text-sm font-semibold text-red-600">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            Recording… {fmt(recordingSeconds)}
          </span>
          <button
            onClick={stopRecording}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500 text-white text-xs font-semibold hover:bg-red-600 transition-colors ml-auto"
          >
            <Square className="w-3 h-3" /> Stop
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={startRecording}
            disabled={uploading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 transition-colors disabled:opacity-50"
          >
            <Mic className="w-4 h-4" />
            Record
          </button>
          <label className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border border-brand-200 bg-brand-50 text-brand-600 text-sm font-semibold cursor-pointer hover:bg-brand-100 transition-colors ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
            <Upload className="w-4 h-4" />
            Upload file
            <input
              type="file"
              accept="audio/*"
              className="sr-only"
              disabled={uploading}
              onChange={e => { if (e.target.files?.[0]) { stagePending(e.target.files[0]); e.target.value = '' } }}
            />
          </label>
        </div>
      ))}

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
