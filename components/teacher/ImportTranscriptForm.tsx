'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Loader2, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react'
import { importTranscript } from '@/app/actions/import'

interface Student {
  id: string
  full_name: string
  language: string
  level: string
}

interface Props {
  students: Student[]
}

export default function ImportTranscriptForm({ students }: Props) {
  const router = useRouter()
  const [studentId, setStudentId] = useState(students[0]?.id ?? '')
  const [lessonDate, setLessonDate] = useState(
    new Date().toISOString().split('T')[0]
  )
  const [transcript, setTranscript] = useState('')
  const [geminiNotes, setGeminiNotes] = useState('')
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!transcript.trim() && !geminiNotes.trim()) return
    setState('loading')
    setMessage('')

    const result = await importTranscript({ studentId, lessonDate, transcript, geminiNotes: geminiNotes || undefined })

    if (!result.success) {
      setMessage(result.error ?? 'Something went wrong')
      setState('error')
      return
    }

    setMessage(result.message ?? 'Processing…')
    setState('done')
  }

  if (state === 'done') {
    return (
      <div className="card p-8 flex flex-col items-center text-center gap-4">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-green-50">
          <CheckCircle2 className="w-7 h-7 text-green-500" />
        </div>
        <div>
          <p className="font-semibold text-ink text-lg">Sent to processing!</p>
          <p className="text-sm text-muted mt-1 max-w-sm">{message}</p>
        </div>
        <div className="flex gap-3 mt-2">
          <button
            className="btn-secondary text-sm"
            onClick={() => {
              setTranscript('')
              setGeminiNotes('')
              setMessage('')
              setState('idle')
            }}
          >
            Import another
          </button>
          <button
            className="btn-primary text-sm"
            onClick={() => router.push('/teacher/dashboard')}
          >
            <ArrowRight className="w-4 h-4" /> Go to dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Student + Date row */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-ink mb-1.5">
            Student
          </label>
          <select
            value={studentId}
            onChange={e => setStudentId(e.target.value)}
            className="input w-full"
            required
          >
            {students.map(s => (
              <option key={s.id} value={s.id}>
                {s.full_name} ({s.language})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-ink mb-1.5">
            Lesson date
          </label>
          <input
            type="date"
            value={lessonDate}
            onChange={e => setLessonDate(e.target.value)}
            className="input w-full"
            required
          />
        </div>
      </div>

      {/* Transcript textarea */}
      <div>
        <label className="block text-sm font-medium text-ink mb-1.5">
          Lesson transcript
        </label>
        <p className="text-xs text-muted mb-2">
          Paste the full Google Meet transcript here. GPT-4o will extract the recap, vocabulary, and homework.
        </p>
        <textarea
          value={transcript}
          onChange={e => setTranscript(e.target.value)}
          placeholder="00:00:05 Teacher: Good morning! How are you today?&#10;00:00:09 Student: I am fine, thank you. And you?&#10;..."
          rows={16}
          className="input w-full font-mono text-xs resize-y"
        />
        <p className="text-xs text-muted mt-1">
          {transcript.length > 0
            ? `${transcript.split('\n').length} lines · ${transcript.length} characters`
            : 'No transcript yet'}
        </p>
      </div>

      {/* Gemini notes textarea */}
      <div>
        <label className="block text-sm font-medium text-ink mb-1.5">
          Gemini meeting notes
        </label>
        <p className="text-xs text-muted mb-2">
          Paste the text from the Gemini AI-generated notes document (auto-created by Google Meet). The AI uses these to build the structured section cards for the student recap.
        </p>
        <textarea
          value={geminiNotes}
          onChange={e => setGeminiNotes(e.target.value)}
          placeholder="Summary&#10;&#10;• Reviewed nationalities using Country + じん&#10;• Practised です/じゃないです patterns&#10;...&#10;&#10;Next steps&#10;&#10;• Review vocabulary from today&#10;..."
          rows={10}
          className="input w-full text-xs resize-y"
        />
        <p className="text-xs text-muted mt-1">
          {geminiNotes.length > 0
            ? `${geminiNotes.split('\n').length} lines · ${geminiNotes.length} characters`
            : 'No notes yet'}
        </p>
      </div>

      {/* Error */}
      {state === 'error' && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{message}</span>
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={state === 'loading' || (!transcript.trim() && !geminiNotes.trim())}
        className="btn-primary w-full justify-center gap-2 py-3"
      >
        {state === 'loading' ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Sending to AI…
          </>
        ) : (
          <>
            <FileText className="w-4 h-4" />
            Process transcript
          </>
        )}
      </button>
    </form>
  )
}
