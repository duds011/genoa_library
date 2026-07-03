'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Mic, Square, Play, Pause, RotateCcw, Loader2, Upload } from 'lucide-react'

// Records or uploads an audio clip to the student-audio bucket and returns its URL.
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
  const [playing, setPlaying] = useState(false)
  const [error, setError] = useState('')

  const recRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  async function upload(file: File) {
    setUploading(true); setError('')
    try {
      const ext = file.name.split('.').pop() ?? 'webm'
      const path = `${pathPrefix}-${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('student-audio').upload(path, file)
      if (upErr) { setError(upErr.message); return }
      const { data: { publicUrl } } = supabase.storage.from('student-audio').getPublicUrl(path)
      setUrl(publicUrl)
      audioRef.current = null
      onUploaded(publicUrl)
    } finally {
      setUploading(false)
    }
  }

  async function start() {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const rec = new MediaRecorder(stream)
      chunksRef.current = []
      rec.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      rec.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        await upload(new File([blob], `fb-${Date.now()}.webm`, { type: 'audio/webm' }))
      }
      rec.start(1000)
      recRef.current = rec
      setRecording(true); setSeconds(0)
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000)
    } catch {
      setError('Microphone access denied.')
    }
  }

  function stop() {
    recRef.current?.stop()
    if (timerRef.current) clearInterval(timerRef.current)
    setRecording(false); setSeconds(0)
  }

  function togglePlay() {
    if (!url) return
    if (playing) { audioRef.current?.pause(); setPlaying(false); return }
    if (!audioRef.current) {
      audioRef.current = new Audio(url)
      audioRef.current.onended = () => setPlaying(false)
    }
    audioRef.current.play(); setPlaying(true)
  }

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  return (
    <div>
      {recording ? (
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-red-600">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> {fmt(seconds)}
          </span>
          <button onClick={stop} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500 text-white text-xs font-semibold hover:bg-red-600">
            <Square className="w-3 h-3" /> Stop & save
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 flex-wrap">
          {url && (
            <button type="button" onClick={togglePlay} className="w-8 h-8 rounded-full bg-brand-600 text-white flex items-center justify-center hover:bg-brand-700">
              {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
            </button>
          )}
          <button type="button" onClick={start} disabled={uploading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-brand-200 bg-brand-50 text-brand-600 text-xs font-semibold hover:bg-brand-100 disabled:opacity-50">
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : (url ? <RotateCcw className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />)}
            {uploading ? 'Uploading…' : url ? 'Re-record' : 'Record audio'}
          </button>
          <label className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-muted text-xs font-semibold cursor-pointer hover:bg-gray-50 ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
            <Upload className="w-3.5 h-3.5" /> Upload
            <input type="file" accept="audio/*" className="sr-only" disabled={uploading}
              onChange={e => { if (e.target.files?.[0]) upload(e.target.files[0]) }} />
          </label>
          {url && <span className="text-xs font-semibold text-green-600">✓ audio attached</span>}
        </div>
      )}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}
