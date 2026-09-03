import { createClient, getUser } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatDateShort } from '@/lib/utils'
import DeleteLessonButton from '@/components/teacher/DeleteLessonButton'
import CheckDriveButton from '@/components/teacher/CheckDriveButton'
import PageHeader from '@/components/PageHeader'

/**
 * The teacher's overview — Lesson Studio's home page, in this portal's terms.
 *
 * The band carries the numbers. The main column is the work queue: recaps
 * that arrived from Drive and are waiting to be reviewed, then who has
 * handed something in. The rail on the right is the three colour-blocked
 * stats and the latest published lessons.
 */
export default async function TeacherDashboard() {
  const supabase = await createClient()
  const user = await getUser() // memoized — shared with the layout

  const [
    { data: students },
    { data: draftLessons },
    { data: recentLessons },
  ] = await Promise.all([
    supabase
      .from('students')
      .select('*')
      .eq('teacher_id', user!.id)
      .is('archived_at', null)
      .order('full_name'),
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
  const publishedCount = recentLessons?.length ?? 0
  const totalLessons = (draftLessons?.length ?? 0) + publishedCount
  const unassignedDrafts = draftLessons?.filter((l: any) => !l.student_id) ?? []
  const assignedDrafts = draftLessons?.filter((l: any) => l.student_id) ?? []
  const pendingDrafts = draftLessons?.length ?? 0

  // Lessons in the last 30 days — the "recent" chip on the lessons stat.
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000
  const recentCount = (recentLessons ?? []).filter((l: any) => l.lesson_date && new Date(l.lesson_date).getTime() >= cutoff).length

  // Build lesson → student map for unreviewed submission lookup
  const allLessons = [...(draftLessons ?? []), ...(recentLessons ?? [])]
  const lessonIdToStudentId: Record<string, string> = {}
  for (const l of allLessons) {
    if (l.student_id) lessonIdToStudentId[l.id] = l.student_id
  }
  const lessonIds = Object.keys(lessonIdToStudentId)

  // Students with unreviewed homework or audio submissions
  const studentsWithUpdates = new Map<string, { hw: number; audio: number; lessonId: string }>()
  if (lessonIds.length > 0) {
    const [{ data: unreviewedHw }, { data: unreviewedAudio }] = await Promise.all([
      supabase.from('homework_submissions').select('lesson_id').in('lesson_id', lessonIds).is('reviewed_at', null),
      supabase.from('student_audio_submissions').select('lesson_id').in('lesson_id', lessonIds).is('reviewed_at', null),
    ])
    for (const row of unreviewedHw ?? []) {
      const sid = lessonIdToStudentId[(row as any).lesson_id]
      if (!sid) continue
      const cur = studentsWithUpdates.get(sid) ?? { hw: 0, audio: 0, lessonId: (row as any).lesson_id }
      cur.hw += 1
      studentsWithUpdates.set(sid, cur)
    }
    for (const row of unreviewedAudio ?? []) {
      const sid = lessonIdToStudentId[(row as any).lesson_id]
      if (!sid) continue
      const cur = studentsWithUpdates.get(sid) ?? { hw: 0, audio: 0, lessonId: (row as any).lesson_id }
      cur.audio += 1
      studentsWithUpdates.set(sid, cur)
    }
  }

  // Names from the roster, then from the lessons' own join — a submission can
  // belong to a student who has since been archived off the roster.
  const studentName = new Map<string, string>()
  for (const l of allLessons) {
    const name = (l.students as any)?.full_name
    if (l.student_id && name) studentName.set(l.student_id, name)
  }
  for (const s of students ?? []) studentName.set(s.id, s.full_name)
  const initials = (name: string) => name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()

  const queue = [...unassignedDrafts, ...assignedDrafts]
  const latest = (recentLessons ?? []).slice(0, 8)

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <PageHeader
        eyebrow="Teacher"
        title="Overview"
        meta={pendingDrafts > 0 ? `${pendingDrafts} recap${pendingDrafts === 1 ? '' : 's'} waiting for your review` : 'Everything is reviewed — nothing waiting.'}
        figures={[
          { label: 'Students', value: totalStudents },
          { label: 'Lessons', value: totalLessons },
          { label: 'To review', value: pendingDrafts },
          { label: 'Published', value: publishedCount },
        ]}
        actions={
          <>
            <CheckDriveButton />
            <Link href="/teacher/students" className="btn btn-primary">Students →</Link>
          </>
        }
      />

      <div className="k-overview">
        <div className="k-overview-main">
          {/* ── The queue ── */}
          <section>
            <div className="g-sec-head">
              <h2>Recaps to review</h2>
              <span className="k-link">{queue.length === 0 ? 'Queue is clear' : `${queue.length} waiting`}</span>
            </div>
            {queue.length === 0 ? (
              <div className="empty">
                <strong style={{ color: 'var(--ink)' }}>Nothing to review</strong>
                <br />
                New recaps arrive here after a lesson is transcribed. Use “Check for new recaps” to scan Drive now.
              </div>
            ) : (
              <div className="g-queue">
                {queue.map((lesson: any) => {
                  const unassigned = !lesson.student_id
                  const parsedName = unassigned
                    ? ((lesson.title ?? '').replace(/^⚠\s*Unassigned\s*—\s*/i, '').replace(/^.*Unassigned.*?—\s*/i, '') || 'Unknown student')
                    : (lesson.students as any)?.full_name
                  return (
                    <div key={lesson.id} className={`g-draft${unassigned ? ' unassigned' : ''}`}>
                      <div className="g-draft-num">{unassigned ? '?' : `L${lesson.lesson_number}`}</div>
                      <div style={{ minWidth: 0 }}>
                        <div className="g-draft-title">{parsedName}</div>
                        <div className="g-draft-meta">
                          {unassigned ? 'No matching student — assign one before publishing' : `Lesson ${lesson.lesson_number}`}
                          {' · '}{formatDateShort(lesson.lesson_date)}
                          {lesson.lesson_summaries?.score != null && ` · ${lesson.lesson_summaries.score}/10`}
                        </div>
                        {lesson.lesson_summaries?.recap && <p className="g-draft-blurb">{lesson.lesson_summaries.recap}</p>}
                      </div>
                      <div className="g-draft-actions">
                        <Link href={`/teacher/lessons/${lesson.id}/edit`} className="btn btn-primary btn-sm">
                          {unassigned ? 'Assign & review' : 'Review & publish'}
                        </Link>
                        <DeleteLessonButton
                          lessonId={lesson.id}
                          lessonLabel={unassigned ? `Unassigned lesson — ${parsedName}` : `Lesson ${lesson.lesson_number} — ${parsedName}`}
                          variant="icon"
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          {/* ── Handed in ── */}
          {studentsWithUpdates.size > 0 && (
            <section>
              <div className="g-sec-head">
                <h2>Handed in</h2>
                <span className="k-link">{studentsWithUpdates.size} student{studentsWithUpdates.size === 1 ? '' : 's'}</span>
              </div>
              <div className="k-card">
                <div className="k-hw">
                  {Array.from(studentsWithUpdates.entries()).map(([sid, u]) => (
                    <div key={sid} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div className="avatar">{initials(studentName.get(sid) ?? '?')}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="k-hw-title">{studentName.get(sid) ?? 'Student'}</div>
                        <div className="k-hw-due">
                          {[u.hw > 0 && `${u.hw} homework`, u.audio > 0 && `${u.audio} recording${u.audio === 1 ? '' : 's'}`].filter(Boolean).join(' · ')} waiting for feedback
                        </div>
                      </div>
                      <Link href={`/teacher/lessons/${u.lessonId}/edit`} className="k-btn-pill">Open</Link>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* ── Students ── */}
          <section>
            <div className="g-sec-head">
              <h2>Your students</h2>
              <Link href="/teacher/students" className="k-link">Manage →</Link>
            </div>
            {totalStudents === 0 ? (
              <div className="empty">
                <strong style={{ color: 'var(--ink)' }}>No students yet</strong>
                <br />
                <Link href="/teacher/students" className="btn btn-primary btn-sm" style={{ marginTop: 12 }}>Add your first student</Link>
              </div>
            ) : (
              <div className="student-grid">
                {students?.map((student: any) => {
                  const update = studentsWithUpdates.get(student.id)
                  const count = (recentLessons ?? []).filter((l: any) => l.student_id === student.id).length
                  return (
                    <Link key={student.id} href={`/teacher/students/${student.id}`} className="student-card" style={{ gridTemplateColumns: 'minmax(180px,1.4fr) 90px minmax(120px,1fr) 24px' }}>
                      <div className="student-identity">
                        <div className="avatar">{initials(student.full_name)}</div>
                        <div style={{ minWidth: 0 }}>
                          <div className="sc-name" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                            {student.full_name}
                            {update && <span className="g-dot" title="New submission" />}
                          </div>
                          <div className="sc-email">{student.email}</div>
                        </div>
                      </div>
                      <div>
                        <div className="analytics-label">Lessons</div>
                        <strong>{count}</strong>
                      </div>
                      <div>
                        <div className="analytics-label">Level</div>
                        <strong style={{ fontSize: 12 }}>{student.level}</strong>
                      </div>
                      <svg className="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                    </Link>
                  )
                })}
              </div>
            )}
          </section>
        </div>

        {/* ── The rail ── */}
        <aside className="k-overview-rail">
          <div className="k-tstats">
            <div className="k-stat yellow">
              <div className="k-stat-head">
                <svg className="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                <span>Students</span>
              </div>
              <div className="k-stat-val"><b>{totalStudents}</b></div>
              <p className="k-stat-sub">active this term</p>
            </div>
            <div className="k-stat blue">
              <div className="k-stat-head">
                <svg className="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5h16v14H4zM4 9h16M9 9v10"/></svg>
                <span>Lessons</span>
              </div>
              <div className="k-stat-val">
                <b>{publishedCount}</b>
                {recentCount > 0 && <span className="k-chip">+{recentCount}</span>}
              </div>
              <p className="k-stat-sub">{recentCount > 0 ? `${recentCount} in the last 30 days` : 'published so far'}</p>
            </div>
            <div className="k-stat purple">
              <div className="k-stat-head">
                <svg className="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
                <span>To review</span>
              </div>
              <div className="k-stat-val"><b>{pendingDrafts}</b></div>
              <p className="k-stat-sub">{pendingDrafts === 0 ? 'the queue is clear' : 'drafts waiting for you'}</p>
            </div>
          </div>

          {latest.length > 0 && (
            <div className="k-card k-rail-card">
              <div className="analytics-label">Latest published</div>
              <div className="k-hw" style={{ gap: 10 }}>
                {latest.map((lesson: any) => (
                  <Link key={lesson.id} href={`/teacher/lessons/${lesson.id}/edit`} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="lc-num" style={{ width: 36, height: 30, fontSize: 9.5 }}>L{lesson.lesson_number}</span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span className="k-hw-title" style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(lesson.students as any)?.full_name}</span>
                      <span className="k-hw-due">{formatDateShort(lesson.lesson_date)}</span>
                    </span>
                    <b style={{ fontSize: 12.5, color: 'var(--forest)' }}>{lesson.lesson_summaries?.score ?? '—'}<span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600 }}>/10</span></b>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
