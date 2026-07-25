import { createClient, getUser } from '@/lib/supabase/server'
import { FileText } from 'lucide-react'
import ImportTranscriptForm from '@/components/teacher/ImportTranscriptForm'

export default async function ImportPage() {
  const supabase = await createClient()
  const user = await getUser() // memoized, shared with the layout

  const { data: students } = await supabase
    .from('students')
    .select('id, full_name, language, level')
    .eq('teacher_id', user!.id)
    .order('full_name')

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2.5 mb-1">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}>
            <FileText className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-ink">Import Transcript</h1>
        </div>
        <p className="text-sm text-muted ml-11">
          Paste a lesson transcript and GPT-4o will generate the recap, vocabulary, and homework automatically.
        </p>
      </div>

      {/* How it works */}
      <div className="bg-brand-50 border border-brand-100 rounded-2xl px-5 py-4 text-sm space-y-2">
        <p className="font-semibold text-brand-700">How it works</p>
        <ol className="list-decimal list-inside space-y-1 text-brand-600">
          <li>Select the student and lesson date below</li>
          <li>Paste the full Google Meet transcript</li>
          <li>Click <strong>Process transcript</strong> â€” AI analysis takes ~10â€“15 seconds</li>
          <li>A <span className="badge-draft inline">draft</span> lesson will appear on the dashboard for you to review and publish</li>
        </ol>
      </div>

      {/* Form */}
      <div className="card p-6">
        {!students || students.length === 0 ? (
          <div className="text-center py-8 text-muted text-sm">
            <p>No students found.</p>
            <p className="mt-1">Add a student first before importing a transcript.</p>
          </div>
        ) : (
          <ImportTranscriptForm students={students} />
        )}
      </div>
    </div>
  )
}
