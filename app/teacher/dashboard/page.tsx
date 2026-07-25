import { createClient, getUser } from '@/lib/supabase/server'
import Link from 'next/link'
import { Users, BookOpen, Clock, PenLine } from 'lucide-react'
import { formatDateShort } from '@/lib/utils'
import DeleteLessonButton from '@/components/teacher/DeleteLessonButton'
import CheckDriveButton from '@/components/teacher/CheckDriveButton'

export default async function TeacherDashboard() {
  const supabase = await createClient()
  const user = await getUser() // memoized — shared with the layout

  // These three queries are independent, so fire them in parallel rather than
  // waiting on each Supabase round-trip in sequence.
  const [
    { data: students },
    { data: draftLessons },
    { data: recentLessons },
  ] = await Promise.all([
    // Active students only — archived ones are retired, not deleted.
    supabase
      .from('students')
      .select('*')
      .eq('teacher_id', user!.id)
      .is('archived_at', null)
      .order('full_name'),
    // Draft lessons (need review)
    supabase
      .from('lessons')
      .select(`
        id, lesson_number, lesson_date, student_id, title,
        students ( full_name ),
        lesson_summaries ( score, recap )
      `)
      .eq('teacher_id', user!.id)
      .eq('status', 'draft')
      .order('created_at', { ascending: false }),
    // All published lessons, newest first
    supabase
      .from('lessons')
      .select(`
        id, lesson_number, lesson_date, student_id,
        students ( full_name ),
        lesson_summaries ( score )
      `)
      .eq('teacher_id', user!.id)
      .eq('status', 'published')
      .order('lesson_date', { ascending: false }),
  ])

  const totalStudents = students?.length ?? 0
  const totalLessons = (draftLessons?.length ?? 0) + (recentLessons?.length ?? 0)
  const unassignedDrafts = draftLessons?.filter((l: any) => !l.student_id) ?? []
  const assignedDrafts = draftLessons?.filter((l: any) => l.student_id) ?? []
  const pendingDrafts = draftLessons?.length ?? 0

  // Build lesson → student map for unreviewed submission lookup
  const allLessons = [...(draftLessons ?? []), ...(recentLessons ?? [])]
  const lessonIdToStudentId: Record<string, string> = {}
  for (const l of allLessons) {
    if (l.student_id) lessonIdToStudentId[l.id] = l.student_id
  }
  const lessonIds = Object.keys(lessonIdToStudentId)

  // Find students with unreviewed homework or audio submissions
  const studentsWithUpdates = new Set<string>()
  if (lessonIds.length > 0) {
    const [{ data: unreviewedHw }, { data: unreviewedAudio }] = await Promise.all([
      supabase.from('homework_submissions').select('lesson_id').in('lesson_id', lessonIds).is('reviewed_at', null),
      supabase.from('student_audio_submissions').select('lesson_id').in('lesson_id', lessonIds).is('reviewed_at', null),
    ])
    for (const row of [...(unreviewedHw ?? []), ...(unreviewedAudio ?? [])]) {
      const sid = lessonIdToStudentId[(row as any).lesson_id]
      if (sid) studentsWithUpdates.add(sid)
    }
  }

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">Dashboard</h1>
          <p className="text-sm text-muted mt-0.5">Overview of your students and lessons</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Link href="/teacher/students" className="btn-primary">
            <Users className="w-4 h-4" /> Manage Students
          </Link>
          <CheckDriveButton />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="stat-card">
          <span className="stat-label">Students</span>
          <span className="stat-value">{totalStudents}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Total Lessons</span>
          <span className="stat-value">{totalLessons}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Pending Review</span>
          <div className="flex items-center gap-2">
            <span className="stat-value text-orange-500">{pendingDrafts}</span>
            {pendingDrafts > 0 && <span className="badge-draft">drafts</span>}
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-label">Published</span>
          <span className="stat-value">{recentLessons?.length ?? 0}</span>
        </div>
      </div>

      {/* Unassigned lessons — need a student assigned before publishing */}
      {unassignedDrafts.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-amber-500 text-base">⚠</span>
            <h2 className="section-title text-amber-700">Unassigned Lessons</h2>
            <span className="text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200 rounded-full px-2.5 py-0.5">{unassignedDrafts.length}</span>
          </div>
          <p className="text-xs text-amber-700 mb-3 -mt-2">These recaps arrived but no matching student was found. Open each one and assign a student before publishing.</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {unassignedDrafts.map((lesson: any) => {
              const parsedName = (lesson.title ?? '').replace(/^⚠\s*Unassigned\s*—\s*/i, '').replace(/^.*Unassigned.*?—\s*/i, '') || 'Unknown student'
              return (
                <div key={lesson.id} className="card p-5 flex flex-col gap-3 border-amber-200 bg-amber-50/30">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5">unassigned</span>
                      </div>
                      <p className="font-semibold text-ink text-sm">{parsedName}</p>
                      <p className="text-xs text-muted">{formatDateShort(lesson.lesson_date)}</p>
                    </div>
                    <DeleteLessonButton
                      lessonId={lesson.id}
                      lessonLabel={`Unassigned lesson — ${parsedName}`}
                      variant="icon"
                    />
                  </div>
                  {lesson.lesson_summaries?.recap && (
                    <p className="text-xs text-muted line-clamp-2">{lesson.lesson_summaries.recap}</p>
                  )}
                  <Link
                    href={`/teacher/lessons/${lesson.id}/edit`}
                    className="btn-secondary w-full justify-center mt-auto border-amber-300 text-amber-700 hover:bg-amber-100"
                  >
                    <PenLine className="w-3.5 h-3.5" /> Assign &amp; Edit
                  </Link>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Drafts needing review */}
      {assignedDrafts.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-orange-500" />
            <h2 className="section-title">Pending Review</h2>
            <span className="badge-draft">{assignedDrafts.length}</span>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {assignedDrafts.map((lesson: any) => (
              <div key={lesson.id} className="card p-5 flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="badge-brand text-xs">
                        Lesson {lesson.lesson_number}
                      </span>
                      <span className="badge-draft">draft</span>
                    </div>
                    <p className="font-semibold text-ink text-sm">
                      {(lesson.students as any)?.full_name}
                    </p>
                    <p className="text-xs text-muted">{formatDateShort(lesson.lesson_date)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {lesson.lesson_summaries?.score && (
                      <span className="text-sm font-bold text-brand-600 mr-1">
                        {lesson.lesson_summaries.score}/10
                      </span>
                    )}
                    <DeleteLessonButton
                      lessonId={lesson.id}
                      lessonLabel={`Lesson ${lesson.lesson_number} — ${(lesson.students as any)?.full_name}`}
                      variant="icon"
                    />
                  </div>
                </div>
                {lesson.lesson_summaries?.recap && (
                  <p className="text-xs text-muted line-clamp-2">
                    {lesson.lesson_summaries.recap}
                  </p>
                )}
                <Link
                  href={`/teacher/lessons/${lesson.id}/edit`}
                  className="btn-primary w-full justify-center mt-auto"
                >
                  <PenLine className="w-3.5 h-3.5" /> Review & Edit
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Students overview */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-4 h-4 text-brand-600" />
          <h2 className="section-title">Your Students</h2>
        </div>

        {totalStudents === 0 ? (
          <div className="card p-12 text-center">
            <p className="text-4xl mb-3">👋</p>
            <p className="font-semibold text-ink mb-1">No students yet</p>
            <p className="text-sm text-muted mb-4">Add your first student to get started</p>
            <Link href="/teacher/students" className="btn-primary">
              Add Student
            </Link>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {students?.map((student: any) => {
              const hasUpdate = studentsWithUpdates.has(student.id)
              return (
                <Link
                  key={student.id}
                  href={`/teacher/students/${student.id}`}
                  className="card p-5 flex flex-col gap-2 hover:border-brand-200 hover:shadow-md transition-all relative"
                >
                  {hasUpdate && (
                    <span className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-white" title="New submission" />
                  )}
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                      style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}>
                      {student.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-ink text-sm">{student.full_name}</p>
                      <p className="text-xs text-muted">{student.level}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="badge-brand text-xs">{student.language}</span>
                    <span className="text-xs text-muted">{student.email}</span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      {/* Recent published lessons */}
      {(recentLessons?.length ?? 0) > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="w-4 h-4 text-brand-600" />
            <h2 className="section-title">Published Lessons</h2>
          </div>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wide">Student</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wide">Lesson</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wide">Date</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wide">Score</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {recentLessons?.map((lesson: any) => (
                  <tr key={lesson.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 font-medium text-ink">
                      {(lesson.students as any)?.full_name}
                    </td>
                    <td className="px-5 py-3 text-muted">#{lesson.lesson_number}</td>
                    <td className="px-5 py-3 text-muted">{formatDateShort(lesson.lesson_date)}</td>
                    <td className="px-5 py-3 text-right">
                      <span className="font-semibold text-brand-600">
                        {lesson.lesson_summaries?.score ?? '—'}/10
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <DeleteLessonButton
                        lessonId={lesson.id}
                        lessonLabel={`Lesson ${lesson.lesson_number} — ${(lesson.students as any)?.full_name}`}
                        variant="row"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
