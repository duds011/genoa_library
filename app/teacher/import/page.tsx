import { createClient, getUser } from '@/lib/supabase/server'
import PageHeader from '@/components/PageHeader'
import ImportTranscriptForm from '@/components/teacher/ImportTranscriptForm'

/**
 * The recap is built while the teacher waits, so this page needs the same
 * ceiling the recorder route asks for — a long transcript is a long completion,
 * and 300 is what this project's Vercel plan allows.
 */
export const maxDuration = 300

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
        meta="For lessons the recorder did not capture. Paste the transcript and the recap, vocabulary and homework are generated for you to review."
      />

      <div className="k-sec">
        <div className="k-sec-head">
          <span className="k-sec-icon b">📄</span>
          <div>
            <h3>How it works</h3>
            <p className="desc">Pick the student and the lesson date, paste the full transcript, then process it. It takes a minute or two and lands as a <b>draft</b> on your overview for you to review and publish. Talk-time is estimated here rather than measured — only the recorder can hear who spoke.</p>
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
