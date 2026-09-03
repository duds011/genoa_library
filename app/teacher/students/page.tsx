import { createClient, getUser } from '@/lib/supabase/server'
import Link from 'next/link'
import AddStudentModal from '@/components/teacher/AddStudentModal'
import SetupStudentLoginButton from '@/components/teacher/SetupStudentLoginButton'
import DeleteStudentButton from '@/components/teacher/DeleteStudentButton'
import ArchiveStudentButton from '@/components/teacher/ArchiveStudentButton'
import PageHeader from '@/components/PageHeader'

/**
 * The roster — Lesson Studio's students directory. One row per student, the
 * numbers that matter beside the name, the admin actions on the right.
 */
export default async function StudentsPage() {
  const supabase = await createClient()
  const user = await getUser() // memoized, shared with the layout

  const { data: students } = await supabase
    .from('students')
    .select(`
      *,
      lessons ( id, status, lesson_date, lesson_summaries ( score ) )
    `)
    .eq('teacher_id', user!.id)
    .order('full_name')

  const active = (students ?? []).filter((s: any) => !s.archived_at)
  const archived = (students ?? []).filter((s: any) => s.archived_at)
  const withLogin = active.filter((s: any) => s.profile_id).length
  const lessonsTotal = (students ?? []).reduce((n: number, s: any) => n + (s.lessons || []).filter((l: any) => l.status === 'published').length, 0)

  const initials = (name: string) => name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()

  function Row({ student, isArchived }: { student: any; isArchived: boolean }) {
    const lessons = student.lessons || []
    const published = lessons.filter((l: any) => l.status === 'published')
    const scores = published.map((l: any) => l.lesson_summaries?.score).filter((s: any) => s != null)
    const avgScore = scores.length
      ? (scores.reduce((a: number, b: number) => a + b, 0) / scores.length).toFixed(1)
      : '—'
    const lastDate = published.map((l: any) => l.lesson_date).filter(Boolean).sort().pop() as string | undefined
    const daysSince = lastDate ? Math.floor((Date.now() - new Date(`${lastDate}T12:00:00`).getTime()) / 86_400_000) : null
    const hasLogin = !!student.profile_id

    return (
      <div className={`student-card g-cols${isArchived ? ' is-archived' : ''}`}>
        <Link href={`/teacher/students/${student.id}`} className="student-identity" title="Open progress & recaps">
          <div className="avatar">{initials(student.full_name)}</div>
          <div style={{ minWidth: 0 }}>
            <div className="sc-name">{student.full_name}</div>
            <div className="sc-email">{student.email}</div>
          </div>
        </Link>
        <div>
          <div className="analytics-label">Lessons</div>
          <strong>{published.length}</strong>
        </div>
        <div>
          <div className="analytics-label">Avg</div>
          <strong style={{ color: 'var(--brand)' }}>{avgScore}</strong>
        </div>
        <div>
          <div className="analytics-label">Last lesson</div>
          <strong style={{ fontSize: 12 }}>
            {daysSince == null ? '—' : daysSince === 0 ? 'Today' : daysSince === 1 ? 'Yesterday' : `${daysSince} days ago`}
          </strong>
        </div>
        <div className="g-actions">
          {!hasLogin && !isArchived ? (
            <SetupStudentLoginButton studentId={student.id} studentName={student.full_name} />
          ) : (
            <span className={`pill ${hasLogin ? 'green' : ''}`}>{hasLogin ? 'Has login' : 'No login'}</span>
          )}
          <ArchiveStudentButton studentId={student.id} studentName={student.full_name} archived={isArchived} />
          <DeleteStudentButton studentId={student.id} studentName={student.full_name} />
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <PageHeader
        eyebrow="Teacher"
        title="Your students"
        figures={[
          { label: 'Students', value: active.length },
          { label: 'With login', value: withLogin },
          { label: 'Lessons published', value: lessonsTotal },
        ]}
        actions={<AddStudentModal teacherId={user!.id} />}
      />

      {active.length === 0 && archived.length === 0 ? (
        <div className="empty">
          <strong style={{ color: 'var(--ink)' }}>No students yet</strong>
          <br />
          Use “Add student” to create the first account.
        </div>
      ) : (
        <div className="student-grid">
          {active.map((student: any) => <Row key={student.id} student={student} isArchived={false} />)}
        </div>
      )}

      {archived.length > 0 && (
        <details>
          <summary className="k-link" style={{ cursor: 'pointer', fontSize: 12 }}>
            Archived · {archived.length}
          </summary>
          <p style={{ fontSize: 12, color: 'var(--muted)', margin: '8px 0 12px' }}>
            Hidden from payments and notes. Their lessons, notes and payments are all still here, and their past payments still count toward your revenue.
          </p>
          <div className="student-grid">
            {archived.map((student: any) => <Row key={student.id} student={student} isArchived />)}
          </div>
        </details>
      )}
    </div>
  )
}
