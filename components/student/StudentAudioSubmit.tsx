'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Mic, Upload, X, Play, Pause, Square } from 'lucide-react'

interface Submission {
  id: string
  file_name: string
  audio_url: string
  created_at: string
}

interface Props {
  lessonId: string
  studentId: string
  initialSubmissions: Submission[]
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

  // Playback state
  const [playingId, setPlayingId] = useState<string | null>(null)
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({})

  async function uploadAudio(file: File, fileName: string) {
    setUploading(true)
    setError('')
    try {
      const ext = fileName.split('.').pop() ?? 'webm'
      const path = `${lessonId}/${Date.now()}.${ext}`

      const { error: upErr } = await supabase.storage
        .from('student-audio')
        .upload(path, file)
      if (upErr) { setError(upErr.message); return }

      const { data: { publicUrl } } = supabase.storage
        .from('student-audio')
        .getPublicUrl(path)

      const { data } = await supabase
        .from('student_audio_submissions')
        .insert({ lesson_id: lessonId, student_id: studentId, audio_url: publicUrl, file_name: fileName })
        .select()
        .single()

      if (data) setSubmissions(prev => [...prev, data as Submission])
    } finally {
      setUploading(false)
    }
  }

  async function handleFileUpload(file: File) {
    await uploadAudio(file, file.name)
  }

  async function startRecording() {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const file = new File([blob], `recording-${Date.now()}.webm`, { type: 'audio/webm' })
        await uploadAudio(file, file.name)
      }
      recorder.start()
      mediaRecorderRef.current = recorder
      setRecording(true)
      setRecordingSeconds(0)
      timerRef.current = setInterval(() => setRecordingSeconds(s => s + 1), 1000)
    } catch {
      setError('Microphone access denied. Please allow microphone access and try again.')
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
            <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl bg-indigo-50 border border-indigo-100">
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
          ))}
        </div>
      )}

      {/* Recording controls */}
      {recording ? (
        <div className="flex items-center gap-4 p-4 rounded-xl bg-red-50 border border-red-100">
          <span className="flex items-center gap-2 text-sm font-semibold text-red-600">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            Recording… {fmt(recordingSeconds)}
          </span>
          <button
            onClick={stopRecording}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500 text-white text-xs font-semibold hover:bg-red-600 transition-colors ml-auto"
          >
            <Square className="w-3 h-3" /> Stop & Save
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
            {uploading ? 'Uploading…' : 'Record'}
          </button>
          <label className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border border-brand-200 bg-brand-50 text-brand-600 text-sm font-semibold cursor-pointer hover:bg-brand-100 transition-colors ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
            <Upload className="w-4 h-4" />
            Upload file
            <input
              type="file"
              accept="audio/*"
              className="sr-only"
              disabled={uploading}
              onChange={e => { if (e.target.files?.[0]) handleFileUpload(e.target.files[0]) }}
            />
          </label>
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
