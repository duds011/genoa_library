import { createClient, getUser } from '@/lib/supabase/server'
import PageHeader from '@/components/PageHeader'
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
    <div className="k-page" style={{ display: 'grid', gap: 18, maxWidth: 820 }}>
      <PageHeader
        eyebrow="Manage"
        title="Import a transcript"
        meta="For lessons that were not on Google Meet. Paste the transcript and the recap, vocabulary and homework are generated for you to review."
      />

      <div className="k-sec">
        <div className="k-sec-head">
          <span className="k-sec-icon b">📄</span>
          <div>
            <h3>How it works</h3>
            <p className="desc">Pick the student and the lesson date, paste the full transcript, then process it. Analysis takes ten to fifteen seconds and lands as a <b>draft</b> on your overview for you to review and publish.</p>
          </div>
        </div>

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
