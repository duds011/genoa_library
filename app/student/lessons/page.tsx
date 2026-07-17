import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatDateShort, ordinal } from '@/lib/utils'

export default async function LessonsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: student } = await supabase
    .from('students')
    .select('*')
    .eq('profile_id', user.id)
    .single()

  if (!student) redirect('/student/dashboard')

  const { data: lessons } = await supabase
    .from('lessons')
    .select(`
      id, lesson_number, lesson_date, title,
      lesson_summaries ( score, recap ),
      homework_items ( id, completed )
    `)
    .eq('student_id', student.id)
    .eq('status', 'published')
    .order('lesson_number', { ascending: false })

  return (
    <div className="space-y-5">
      <div className="card p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-muted uppercase tracking-widest mb-1">Lessons</p>
          <h1 className="text-2xl font-extrabold text-ink">Your lesson library</h1>
          <p className="text-sm text-muted mt-1">Open any published recap, homework, vocabulary, or practice exercise.</p>
        </div>
        <Link href="/student/dashboard" className="btn-secondary px-4 py-2 text-xs">
          Back to dashboard
        </Link>
      </div>

      <div className="grid sm:grid-cols-2 gap-3" data-tour="lessons">
        {(lessons || []).map((lesson: any) => {
          const homework = lesson.homework_items || []
          const openHomework = homework.filter((item: any) => !item.completed).length

          return (
            <Link
              key={lesson.id}
              href={`/student/lessons/${lesson.id}`}
              className="card p-4 flex flex-col gap-2 hover:border-brand-200 hover:shadow-md transition-all"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="badge-brand text-xs">Lesson {lesson.lesson_number}</span>
                {lesson.lesson_summaries?.score != null && (
                  <span className="text-xs font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full">
                    {lesson.lesson_summaries.score}/10
                  </span>
                )}
              </div>

              <div>
                <h2 className="font-bold text-ink text-sm leading-snug">
                  {lesson.title || `Lesson ${lesson.lesson_number}`}
                </h2>
                <p className="text-xs text-muted mt-0.5">
                  {ordinal(lesson.lesson_number)} lesson • {formatDateShort(lesson.lesson_date)}
                </p>
              </div>

              {lesson.lesson_summaries?.recap && (
                <p className="text-xs text-muted line-clamp-2">{lesson.lesson_summaries.recap}</p>
              )}

              <div className="flex items-center justify-between gap-2 mt-auto pt-1">
                <span className="text-[11px] text-muted">
                  {openHomework > 0 ? `${openHomework} homework item${openHomework === 1 ? '' : 's'} open` : 'Recap ready'}
                </span>
                <span className="text-xs font-semibold text-brand-600">Open →</span>
              </div>
            </Link>
          )
        })}

        {(lessons?.length ?? 0) === 0 && (
          <div className="sm:col-span-2 card p-12 text-center">
            <p className="text-4xl mb-3">📖</p>
            <p className="font-semibold text-ink">No lessons yet</p>
            <p className="text-sm text-muted mt-1">Your lessons will appear here once published by your teacher.</p>
          </div>
        )}
      </div>
    </div>
  )
}
