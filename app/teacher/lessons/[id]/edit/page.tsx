import { createClient, getUser } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import LessonEditor from '@/components/teacher/LessonEditor'
import ExerciseReview from '@/components/teacher/ExerciseReview'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
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
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back */}
      <Link
        href={(lesson.students as any)?.id ? `/teacher/students/${(lesson.students as any)?.id}` : '/teacher/dashboard'}
        className="btn-ghost text-xs -ml-1 inline-flex"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        {(lesson.students as any)?.full_name ?? 'Dashboard'}
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`badge ${lesson.status === 'draft' ? 'badge-draft' : 'badge-green'}`}>
              {lesson.status}
            </span>
            {lesson.lesson_number && <span className="badge-brand">Lesson {lesson.lesson_number}</span>}
            {!(lesson.students as any)?.id && (
              <span className="text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5">⚠ unassigned</span>
            )}
          </div>
          <h1 className="text-xl font-bold text-ink">
            Edit Lesson — {(lesson.students as any)?.full_name ?? <span className="text-amber-600">Unassigned</span>}
          </h1>
          <p className="text-sm text-muted">{formatDateShort(lesson.lesson_date)}</p>
        </div>
      </div>

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

      {/* Auto-generated practice exercises — review before publishing + student results */}
      {exercises.length > 0 && (
        <ExerciseReview
          lessonId={lesson.id}
          exercises={exercises as any}
          submissions={(exSubmissions ?? []) as any}
          initialShow={(lesson as any).show_exercises !== false}
        />
      )}
    </div>
  )
}
