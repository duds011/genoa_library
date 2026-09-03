import { createClient, getUser } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import LessonEditor from '@/components/teacher/LessonEditor'
import ExerciseReview from '@/components/teacher/ExerciseReview'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'
import { formatDateShort } from '@/lib/utils'
import { markLessonSubmissionsReviewed } from '@/app/actions/lessons'

export default async function EditLessonPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = await createClient()
  const user = await getUser() // memoized, shared with the layout

  const { data: lesson } = await supabase
    .from('lessons')
    .select(`
      *,
      students ( id, full_name, email, level, language ),
      lesson_summaries ( * ),
      vocabulary_items ( * ),
      homework_items ( * ),
      lesson_sections ( * ),
      lesson_attachments ( * ),
      lesson_exercises ( * )
    `)
    .eq('id', params.id)
    .eq('teacher_id', user!.id)
    .single()

  if (!lesson) notFound()

  // Mark all submissions for this lesson as reviewed (clears red dot)
  await markLessonSubmissionsReviewed(params.id)

  // Fetch all students for reassignment dropdown
  const { data: allStudents } = await supabase
    .from('students')
    .select('id, full_name, email')
    .eq('teacher_id', user!.id)
    .order('full_name')

  const { data: hwSubmissions } = await supabase
    .from('homework_submissions')
    .select('*')
    .eq('lesson_id', params.id)
    .order('created_at')

  const { data: audioSubmissions } = await supabase
    .from('student_audio_submissions')
    .select('*')
    .eq('lesson_id', params.id)
    .order('created_at')

  const { data: exSubmissions } = await supabase
    .from('exercise_submissions')
    .select('exercise_id, answer, is_correct')
    .eq('lesson_id', params.id)

  // Sort items
  const vocab = (lesson.vocabulary_items || []).sort(
    (a: any, b: any) => a.sort_order - b.sort_order
  )
  const homework = (lesson.homework_items || []).sort(
    (a: any, b: any) => a.sort_order - b.sort_order
  )
  const sections = (lesson.lesson_sections || []).sort(
    (a: any, b: any) => a.sort_order - b.sort_order
  )
  const attachments = (lesson.lesson_attachments || []).sort(
    (a: any, b: any) => a.sort_order - b.sort_order
  )
  const exercises = (lesson.lesson_exercises || []).sort(
    (a: any, b: any) => a.sort_order - b.sort_order
  )

  return (
    <div className="k-page" style={{ display: 'grid', gap: 16, maxWidth: 960 }}>
      <div>
        <Link
          href={(lesson.students as any)?.id ? `/teacher/students/${(lesson.students as any)?.id}` : '/teacher/dashboard'}
          className="btn btn-ghost btn-sm"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          {(lesson.students as any)?.full_name ?? 'Overview'}
        </Link>
      </div>

      <PageHeader
        eyebrow={`${lesson.status === 'draft' ? 'Draft' : 'Published'}${lesson.lesson_number ? ` · Lesson ${lesson.lesson_number}` : ''}`}
        title={(lesson.students as any)?.full_name ?? 'Unassigned lesson'}
        meta={`${formatDateShort(lesson.lesson_date)}${!(lesson.students as any)?.id ? ' · no matching student — assign one below before publishing' : ''}`}
        figures={[
          ...((lesson.lesson_summaries as any)?.score != null ? [{ label: 'Score', value: <>{(lesson.lesson_summaries as any).score}<i>/10</i></> }] : []),
          ...((lesson.lesson_summaries as any)?.talk_percentage != null ? [{ label: 'Talk', value: <>{(lesson.lesson_summaries as any).talk_percentage}<i>%</i></> }] : []),
          { label: 'Words', value: vocab.length },
          { label: 'Homework', value: homework.length },
        ]}
      />

      {/* Editor */}
      <LessonEditor
        lessonId={lesson.id}
        lessonTitle={lesson.title ?? ''}
        lessonNumber={lesson.lesson_number ?? 1}
        status={lesson.status}
        studentId={(lesson.students as any)?.id ?? ''}
        allStudents={(allStudents ?? []) as { id: string; full_name: string; email: string }[]}
        summary={lesson.lesson_summaries}
        audioScript={(lesson.lesson_summaries as any)?.audio_script ?? ''}
        voiceFileUrl={(lesson as any).voice_file_url ?? ''}
        vocab={vocab}
        homework={homework}
        sections={sections}
        attachments={attachments}
        hwSubmissions={(hwSubmissions ?? []) as any[]}
        audioSubmissions={(audioSubmissions ?? []) as any[]}
        studentEmail={(lesson.students as any)?.email ?? ''}
        rawTranscript={lesson.raw_transcript}
      />

      {/* Practice exercises — review, reword or write before publishing, plus
          the student's results. Shown even with none generated, since this is
          also where an exercise gets written by hand. */}
      <ExerciseReview
        lessonId={lesson.id}
        exercises={exercises as any}
        submissions={(exSubmissions ?? []) as any}
        initialShow={(lesson as any).show_exercises !== false}
      />
    </div>
  )
}
