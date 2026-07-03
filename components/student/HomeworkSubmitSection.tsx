'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Paperclip, Upload, X } from 'lucide-react'

interface Submission {
  id: string
  file_name: string
  file_url: string
  teacher_feedback: string | null
  feedback_audio_url: string | null
  feedback_sent_at: string | null
  created_at: string
}

interface Props {
  lessonId: string
  studentId: string
  initialSubmissions: Submission[]
}

export default function HomeworkSubmitSection({ lessonId, studentId, initialSubmissions }: Props) {
  const supabase = createClient()
  const [submissions, setSubmissions] = useState<Submission[]>(initialSubmissions)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  async function handleUpload(file: File) {
    setUploading(true)
    setError('')
    try {
      const ext = file.name.split('.').pop() ?? 'pdf'
      const path = `${lessonId}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('homework-submissions')
        .upload(path, file)
      if (upErr) { setError(upErr.message); return }

      const { data: { publicUrl } } = supabase.storage
        .from('homework-submissions')
        .getPublicUrl(path)

      const { data } = await supabase
        .from('homework_submissions')
        .insert({ lesson_id: lessonId, student_id: studentId, file_name: file.name, file_url: publicUrl })
        .select()
        .single()

      if (data) setSubmissions(prev => [...prev, data as Submission])
    } finally {
      setUploading(false)
    }
  }

  async function removeSubmission(id: string, fileUrl: string) {
    const path = fileUrl.split('/homework-submissions/')[1]
    if (path) await supabase.storage.from('homework-submissions').remove([decodeURIComponent(path)])
    await supabase.from('homework_submissions').delete().eq('id', id)
    setSubmissions(prev => prev.filter(s => s.id !== id))
  }

  const feedback = submissions.find(s => s.teacher_feedback || s.feedback_audio_url)

  return (
    <div className="card p-6 space-y-4">
      <div>
        <h2 className="section-title mb-1">📤 Submit Homework</h2>
        <p className="text-xs text-muted">Upload your completed work here. Your teacher will review it and send you feedback.</p>
      </div>

      {/* Teacher feedback */}
      {feedback && (feedback.teacher_feedback || feedback.feedback_audio_url) && (
        <div className="p-4 rounded-xl border border-brand-200 bg-brand-50">
          <p className="text-[10px] font-bold text-brand-600 uppercase tracking-widest mb-1.5">Noa Feedback</p>
          {feedback.teacher_feedback && <p className="text-sm text-ink leading-relaxed whitespace-pre-line">{feedback.teacher_feedback}</p>}
          {feedback.feedback_audio_url && <audio controls src={feedback.feedback_audio_url} className="w-full h-9 mt-2" />}
        </div>
      )}

      {/* Submitted files */}
      {submissions.length > 0 && (
        <div className="space-y-2">
          {submissions.map(s => (
            <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
              <Paperclip className="w-4 h-4 text-brand-400 shrink-0" />
              <a
                href={s.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-brand-700 hover:underline flex-1 truncate"
              >
                {s.file_name}
              </a>
              <button
                onClick={() => removeSubmission(s.id, s.file_url)}
                className="text-gray-300 hover:text-red-400 transition-colors"
                title="Remove"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload button */}
      <label className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${uploading ? 'border-brand-200 bg-brand-50 opacity-60 pointer-events-none' : 'border-brand-200 bg-brand-50 hover:bg-brand-100 text-brand-600'}`}>
        <Upload className="w-4 h-4" />
        <span className="text-sm font-semibold">{uploading ? 'Uploading…' : 'Upload a file'}</span>
        <input
          type="file"
          className="sr-only"
          disabled={uploading}
          onChange={e => { if (e.target.files?.[0]) handleUpload(e.target.files[0]) }}
        />
      </label>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
