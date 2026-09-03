import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { formatDateShort, ordinal, testScore } from '@/lib/utils'
import ProgressSwipe from '@/components/student/ProgressSwipe'
import VocabLevelBreakdown from '@/components/student/VocabLevelBreakdown'
import ResetPasswordButton from '@/components/teacher/ResetPasswordButton'
import UpdateEmailButton from '@/components/teacher/UpdateEmailButton'
import SpokenLanguageSelect from '@/components/teacher/SpokenLanguageSelect'
import DeleteLessonButton from '@/components/teacher/DeleteLessonButton'
import BuildTestButton from '@/components/teacher/BuildTestButton'
import PageHeader from '@/components/PageHeader'
import MilestoneTrack from '@/components/MilestoneTrack'

/**
 * One student, the teacher's view — the shape of Lesson Studio's student
 * page: the band with the headline figures and the admin actions, the
 * progress chart, then lessons and tests as two sibling lists.
 */
export default async function StudentDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = await createClient()

  const [
    { data: student },
    { data: lessons },
    { data: tests },
  ] = await Promise.all([
    supabase
      .from('students')
      .select('*')
      .eq('id', params.id)
      .single(),
    supabase
      .from('lessons')
      .select(`
        id, lesson_number, lesson_date, status, title,
        lesson_summaries ( score, talk_percentage, recap, vocab_level_distribution, vocab_total_count, metrics ),
        vocabulary_items ( id, jlpt_level ),
        homework_items ( id, completed )
      `)
      .eq('student_id', params.id)
      .order('lesson_number', { ascending: true }),
    supabase
      .from('tests')
      .select('id, title, status, duration_minutes, lesson_numbers, created_at, test_questions ( id, type, points )')
      .eq('student_id', params.id)
      .order('created_at', { ascending: false }),
  ])

  if (!student) notFound()

  const published = (lessons || []).filter((l: any) => l.status === 'published')
  const drafts    = (lessons || []).filter((l: any) => l.status === 'draft')

  const testIds = (tests || []).map((t: any) => t.id)
  const testResults = new Map<string, { submitted: boolean } & ReturnType<typeof testScore>>()
  if (testIds.length > 0) {
    const [{ data: attempts }, { data: testSubs }] = await Promise.all([
      supabase.from('test_attempts').select('test_id, submitted_at').in('test_id', testIds),
      supabase.from('test_submissions').select('test_id, question_id, score').in('test_id', testIds),
    ])
    const submittedIds = new Set(
      (attempts ?? []).filter((a: any) => a.submitted_at).map((a: any) => a.test_id),
    )
    for (const t of tests || []) {
      testResults.set((t as any).id, {
        submitted: submittedIds.has((t as any).id),
        ...testScore(
          ((t as any).test_questions ?? []),
          (testSubs ?? []).filter((s: any) => s.test_id === (t as any).id),
        ),
      })
    }
  }

  // Which lessons have unreviewed homework or audio submissions
  const lessonIds = (lessons || []).map((l: any) => l.id)
  const lessonsWithUpdates = new Set<string>()
  if (lessonIds.length > 0) {
    const [{ data: unreviewedHw }, { data: unreviewedAudio }] = await Promise.all([
      supabase.from('homework_submissions').select('lesson_id').in('lesson_id', lessonIds).is('reviewed_at', null),
      supabase.from('student_audio_submissions').select('lesson_id').in('lesson_id', lessonIds).is('reviewed_at', null),
    ])
    for (const row of [...(unreviewedHw ?? []), ...(unreviewedAudio ?? [])]) {
      lessonsWithUpdates.add((row as any).lesson_id)
    }
  }

  const scores      = published.map((l: any) => l.lesson_summaries?.score).filter(Boolean)
  const latestScore = scores[scores.length - 1] ?? null
  const avgScore    = scores.length ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length : null

  const talks      = published.map((l: any) => l.lesson_summaries?.talk_percentage).filter(Boolean)
  const latestTalk = talks[talks.length - 1] ?? null

  const vocabDistribution: Record<string, number> = {}
  for (const lesson of published) {
    const dist = (lesson as any).lesson_summaries?.vocab_level_distribution
    if (dist && typeof dist === 'object') {
      for (const [level, count] of Object.entries(dist)) {
        vocabDistribution[level] = (vocabDistribution[level] ?? 0) + (count as number)
      }
    }
  }
  const hasDistribution = Object.values(vocabDistribution).some(v => v > 0)

  const allVocabRaw = published.flatMap((l: any) => l.vocabulary_items || [])
  const seenWords = new Set<string>()
  const allVocab = allVocabRaw.filter((v: any) => {
    if (!v.jlpt_level) return false
    const key = (v.word ?? '').trim().toLowerCase()
    if (!key || seenWords.has(key)) return false
    seenWords.add(key)
    return true
  })

  const totalVocab = hasDistribution
    ? Object.values(vocabDistribution).reduce((sum, n) => sum + n, 0)
    : allVocab.length

  const lessonCount = published.reduce((max: number, l: any) => Math.max(max, l.lesson_number ?? 0), 0)

  // Newest first — ProgressSwipe reverses into chronological order itself.
  const chartData = [...published].reverse().map((l: any) => {
    const s = l.lesson_summaries
    const m = s?.metrics ?? {}
    return {
      lessonNumber: l.lesson_number,
      score: s?.score ?? null,
      talkPct: s?.talk_percentage ?? null,
      vocabCount: s?.vocab_total_count ?? (l.vocabulary_items?.length ?? 0),
      wpm: m.studentWpm ?? null,
      responseSec: m.avgResponseSec ?? null,
    }
  })

  const initials = student.full_name.split(' ').map((p: string) => p[0]).slice(0, 2).join('').toUpperCase()
  // Newest first — the teacher opens this to reach the latest recap.
  const rows = [...drafts, ...published].sort((a: any, b: any) => (b.lesson_number ?? 0) - (a.lesson_number ?? 0))

  return (
    <div className="k-page" style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <Link href="/teacher/students" className="btn btn-ghost btn-sm">← All students</Link>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <SpokenLanguageSelect studentId={student.id} current={student.spoken_language} />
          <UpdateEmailButton studentId={student.id} currentEmail={student.email} />
          {student.profile_id && <ResetPasswordButton studentId={student.id} />}
        </div>
      </div>

      <PageHeader
        lead={<div className="avatar lg">{initials}</div>}
        title={student.full_name}
        meta={`${student.email} · ${student.level} · ${student.language}`}
        figures={[
          { label: 'Lessons', value: lessonCount },
          { label: 'Avg score', value: <>{avgScore != null ? avgScore.toFixed(1) : '—'}<i>/10</i></> },
          { label: 'Latest score', value: <>{latestScore ?? '—'}<i>/10</i></> },
          { label: 'Latest talk', value: <>{latestTalk ?? '—'}<i>%</i></> },
          { label: 'Vocab', value: totalVocab },
        ]}
        wideActions
        actions={
          <>
            {drafts.length > 0 && (
              <span className="pill amber">{drafts.length} draft{drafts.length > 1 ? 's' : ''} to review</span>
            )}
            <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
              <BuildTestButton
                studentId={student.id}
                lessons={published.map((l: any) => ({ id: l.id, lesson_number: l.lesson_number, title: l.title, lesson_date: l.lesson_date }))}
              />
              <Link href={`/teacher/students/${student.id}/preview`} className="btn btn-ghost btn-sm">Student view →</Link>
            </span>
          </>
        }
      />

      {/* Progress + milestones, side by side where there is room */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.6fr) minmax(280px,.9fr)', gap: 14, alignItems: 'start' }} className="g-two-col">
        <div className="k-card k-chart-card">
          <div className="k-card-head"><h3>Progress over time</h3><span className="k-link">{published.length} lesson{published.length === 1 ? '' : 's'}</span></div>
          {chartData.length > 1 ? (
            <ProgressSwipe lessons={chartData} />
          ) : (
            <div className="k-swipe-empty">A trend needs two scored lessons.</div>
          )}
        </div>
        <div style={{ display: 'grid', gap: 14 }}>
          <div className="k-card">
            <div className="k-card-head"><h3>Milestones</h3></div>
            <MilestoneTrack lessonCount={lessonCount} />
          </div>
          {totalVocab > 0 && (
            <div className="k-card">
              <div className="k-card-head"><h3>Vocabulary</h3><span className="k-link">{totalVocab} words</span></div>
              {hasDistribution
                ? <VocabLevelBreakdown distribution={vocabDistribution} totalCount={totalVocab} />
                : <VocabLevelBreakdown vocab={allVocab} />}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16, alignItems: 'start' }}>
        <section>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 44, margin: '0 0 11px' }}>
            <h2 className="section-heading" style={{ margin: 0 }}>Lessons & recaps</h2>
          </div>
          {rows.length === 0 ? (
            <div className="empty"><strong style={{ color: 'var(--ink)' }}>No lessons yet</strong><br />Recaps for this student will appear here once a transcript comes through.</div>
          ) : (
            <div>
              {rows.map((lesson: any) => {
                const s = lesson.lesson_summaries
                const hasUpdate = lessonsWithUpdates.has(lesson.id)
                return (
                  <div key={lesson.id} className="lesson-card">
                    <Link href={`/teacher/lessons/${lesson.id}/edit`} className="lc-num">L{lesson.lesson_number}</Link>
                    <Link href={`/teacher/lessons/${lesson.id}/edit`} style={{ minWidth: 0 }}>
                      <div className="lc-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lesson.title || `Lesson ${lesson.lesson_number}`}</span>
                        {hasUpdate && <span className="g-dot" title="New submission" />}
                      </div>
                      <div className="lc-meta">
                        {ordinal(lesson.lesson_number)} lesson · {formatDateShort(lesson.lesson_date)}
                        {s?.talk_percentage != null && ` · ${s.talk_percentage}% talk`}
                        {` · ${lesson.vocabulary_items?.length ?? 0} words`}
                      </div>
                    </Link>
                    <div className="lc-tools">
                      <span className={`status-pill ${lesson.status === 'published' ? 'published' : 'draft'}`}>{lesson.status}</span>
                      {s?.score != null && <span className="lc-score" style={{ color: 'var(--brand)' }}>{s.score}<span style={{ fontSize: 10, color: 'var(--muted)' }}>/10</span></span>}
                      <DeleteLessonButton lessonId={lesson.id} lessonLabel={`Lesson ${lesson.lesson_number}`} variant="row" />
                    </div>
                    <Link href={`/teacher/lessons/${lesson.id}/edit`} className="lc-arrow">→</Link>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, minHeight: 44, margin: '0 0 11px' }}>
            <h2 className="section-heading" style={{ margin: 0 }}>Tests</h2>
          </div>
          {(tests ?? []).length === 0 ? (
            <div className="empty" style={{ padding: 26 }}>
              <strong style={{ color: 'var(--ink)' }}>No tests yet</strong>
              <br />
              Build an exam-style test from any published lesson. You review it before the student sees it.
            </div>
          ) : (
            <div>
              {(tests as any[]).map((t) => {
                const result = testResults.get(t.id)
                return (
                  <Link key={t.id} href={`/teacher/tests/${t.id}`} className="lesson-card">
                    <div className="lc-num" style={{ background: 'var(--amber-soft)', color: 'var(--amber)' }}>{t.duration_minutes}m</div>
                    <div style={{ minWidth: 0 }}>
                      <div className="lc-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
                      <div className="lc-meta">
                        {t.lesson_numbers?.length > 0 ? `Lessons ${t.lesson_numbers.join(', ')} · ` : ''}{formatDateShort(t.created_at)}
                        {result?.submitted && ` · ${result.score}/${result.maxScore} (${result.percent}%)`}
                        {result?.submitted && result.awaiting > 0 && ` · ${result.awaiting} to grade`}
                      </div>
                    </div>
                    <span className={`status-pill ${t.status === 'published' ? 'published' : 'draft'}`}>
                      {result?.submitted ? (result.awaiting > 0 ? 'to grade' : 'scored') : t.status}
                    </span>
                    <span className="lc-arrow">→</span>
                  </Link>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
