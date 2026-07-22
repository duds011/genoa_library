import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import AddStudentForm from '@/components/teacher/AddStudentForm'
import SetupStudentLoginButton from '@/components/teacher/SetupStudentLoginButton'
import DeleteStudentButton from '@/components/teacher/DeleteStudentButton'
import ArchiveStudentButton from '@/components/teacher/ArchiveStudentButton'
import { ArrowRight, BookOpen } from 'lucide-react'

export default async function StudentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: students } = await supabase
    .from('students')
    .select(`
      *,
      lessons ( id, status, lesson_summaries ( score ) )
    `)
    .eq('teacher_id', user!.id)
    .order('full_name')

  const active = (students ?? []).filter((s: any) => !s.archived_at)
  const archived = (students ?? []).filter((s: any) => s.archived_at)

  function StudentCard({ student, isArchived }: { student: any; isArchived: boolean }) {
    const lessons = student.lessons || []
    const published = lessons.filter((l: any) => l.status === 'published')
    const scores = published
      .map((l: any) => l.lesson_summaries?.score)
      .filter((s: any) => s != null)
    const avgScore = scores.length
      ? (scores.reduce((a: number, b: number) => a + b, 0) / scores.length).toFixed(1)
      : null

    const hasLogin = !!student.profile_id

    return (
      <div className="space-y-2">
        <Link
          href={`/teacher/students/${student.id}`}
          className={`card p-5 flex items-center gap-4 hover:border-brand-200 hover:shadow-md transition-all ${isArchived ? 'opacity-60' : ''}`}
        >
          <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold shrink-0"
            style={{ background: isArchived ? '#9ca3af' : 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}>
            {student.full_name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-ink">{student.full_name}</p>
            <p className="text-xs text-muted truncate">{student.email}</p>
          </div>
          <div className="text-right shrink-0">
            <div className="flex items-center gap-1 justify-end">
              <BookOpen className="w-3.5 h-3.5 text-muted" />
              <span className="text-sm font-semibold text-ink">{published.length}</span>
            </div>
            {avgScore && (
              <span className="text-xs text-brand-600 font-medium">{avgScore}/10 avg</span>
            )}
          </div>
          <ArrowRight className="w-4 h-4 text-muted shrink-0" />
        </Link>

        {/* Archive (reversible) sits next to delete (permanent) */}
        <div className="flex justify-end items-center gap-1 px-1">
          <ArchiveStudentButton
            studentId={student.id}
            studentName={student.full_name}
            archived={isArchived}
          />
          <DeleteStudentButton studentId={student.id} studentName={student.full_name} />
        </div>

        {/* Show setup button if student has no auth account */}
        {!isArchived && !hasLogin && (
          <SetupStudentLoginButton
            studentId={student.id}
            studentName={student.full_name}
          />
        )}
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Students</h1>
          <p className="text-sm text-muted mt-0.5">
            {active.length} active student{active.length !== 1 ? 's' : ''}
            {archived.length > 0 && ` · ${archived.length} archived`}
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Students list */}
        <div className="lg:col-span-3 space-y-3">
          {active.length === 0 && archived.length === 0 ? (
            <div className="card p-10 text-center">
              <p className="text-3xl mb-2">👋</p>
              <p className="font-semibold text-ink">No students yet</p>
              <p className="text-sm text-muted mt-1">Add your first student using the form →</p>
            </div>
          ) : (
            active.map((student: any) => (
              <StudentCard key={student.id} student={student} isArchived={false} />
            ))
          )}

          {archived.length > 0 && (
            <details className="pt-4">
              <summary className="cursor-pointer text-xs font-semibold text-muted uppercase tracking-wide hover:text-ink">
                Archived ({archived.length})
              </summary>
              <p className="text-xs text-muted mt-2 mb-3">
                Hidden from payments and notes. Their lessons, notes and payments are all still here,
                and their past payments still count toward your revenue.
              </p>
              <div className="space-y-3">
                {archived.map((student: any) => (
                  <StudentCard key={student.id} student={student} isArchived={true} />
                ))}
              </div>
            </details>
          )}
        </div>

        {/* Add student form */}
        <div className="lg:col-span-2">
          <AddStudentForm teacherId={user!.id} />
        </div>
      </div>
    </div>
  )
}
