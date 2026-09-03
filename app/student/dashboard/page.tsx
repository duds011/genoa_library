import { createClient, getUser } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatDateShort, getLevelLabel, ordinal } from '@/lib/utils'
import ProgressCharts from '@/components/student/ProgressCharts'
import VocabLevelBreakdown from '@/components/student/VocabLevelBreakdown'
import StudentTour from '@/components/student/StudentTour'
import JapaneseLearningMapCard from '@/components/student/JapaneseLearningMapCard'
import { buildJapaneseLearningMap } from '@/lib/japaneseLearningMap'
import DashboardTabs from '@/components/student/DashboardTabs'
import LessonPillar, { type PillarLesson } from '@/components/student/LessonPillar'
import MilestoneTrack from '@/components/MilestoneTrack'

const Icon = ({ d }: { d: string }) => (
  <svg className="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
)

/**
 * The student's home — Lesson Studio's student dashboard: a greeting, then
 * one tab at a time. Overview leads with the three colour-blocked figures and
 * the milestone ladder; Lessons is the pillar; Progress the charts and the
 * learning map; Tests the tiles.
 */
export default async function StudentDashboard() {
  const supabase = await createClient()
  const user = await getUser() // memoized — shared with the layout
  if (!user) redirect('/login')

  const { data: student } = await supabase
    .from('students')
    .select('*')
    .eq('profile_id', user.id)
    .single()

  if (!student) {
    return (
      <div className="k-empty">
        <p style={{ fontSize: 34, margin: '0 0 8px' }}>⏳</p>
        <strong style={{ color: 'var(--ink)' }}>Account not linked yet</strong>
        <br />
        Ask your teacher to link your account.
      </div>
    )
  }

  const displayName = (student.full_name || user.email || 'student').trim().split(/\s+/)[0]

  const [
    { data: lessons },
    { data: learningLessons },
    { data: tests },
  ] = await Promise.all([
    supabase
      .from('lessons')
      .select(`
        id, lesson_number, lesson_date, title,
        lesson_summaries ( score, talk_percentage, recap, vocab_level_distribution, vocab_total_count ),
        vocabulary_items ( id, word, jlpt_level ),
        homework_items ( id, completed )
      `)
      .eq('student_id', student.id)
      .eq('status', 'published')
      .order('lesson_number', { ascending: false }),
    supabase
      .from('lessons')
      .select(`
        id, lesson_number, title,
        lesson_sections ( title, content )
      `)
      .eq('student_id', student.id)
      .eq('status', 'published')
      .order('lesson_number', { ascending: true }),
    supabase
      .from('tests')
      .select('id, title, duration_minutes, lesson_numbers, created_at, test_attempts ( started_at, submitted_at )')
      .eq('student_id', student.id)
      .eq('status', 'published')
      .order('created_at', { ascending: false }),
  ])

  const rows = (lessons || []) as any[]
  const lessonCount = rows.reduce((max: number, l: any) => Math.max(max, l.lesson_number ?? 0), 0)
  const scores = rows.map((l: any) => l.lesson_summaries?.score).filter((s: any) => s != null) as number[]
  const latestScore = scores[0] ?? null
  const avgScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null
  const firstScore = scores[scores.length - 1] ?? null
  const scoreDelta = latestScore != null && firstScore != null ? latestScore - firstScore : null
  const talks = rows.map((l: any) => l.lesson_summaries?.talk_percentage).filter((t: any) => t != null) as number[]
  const latestTalk = talks[0] ?? null
  const firstTalk = talks[talks.length - 1] ?? null
  const talkDelta = latestTalk != null && firstTalk != null ? latestTalk - firstTalk : null

  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000
  const recentCount = rows.filter((l) => l.lesson_date && new Date(l.lesson_date).getTime() >= cutoff).length

  const vocabDistribution: Record<string, number> = {}
  for (const lesson of rows) {
    const dist = lesson.lesson_summaries?.vocab_level_distribution
    if (dist && typeof dist === 'object') {
      for (const [level, count] of Object.entries(dist)) {
        vocabDistribution[level] = (vocabDistribution[level] ?? 0) + (count as number)
      }
    }
  }
  const totalVocab = Object.values(vocabDistribution).reduce((sum, n) => sum + n, 0)
  const allVocabRaw = rows.flatMap((l: any) => l.vocabulary_items || [])
  const seenWords = new Set<string>()
  const allVocab = allVocabRaw.filter((v: any) => {
    if (!v.jlpt_level) return false
    const key = (v.word ?? '').trim().toLowerCase()
    if (!key || seenWords.has(key)) return false
    seenWords.add(key)
    return true
  })
  const hasDistribution = totalVocab > 0
  const vocabShown = hasDistribution ? totalVocab : allVocab.length

  const learningMap = buildJapaneseLearningMap((learningLessons || []) as any)

  const pillarLessons: PillarLesson[] = rows.map((lesson) => ({
    id: lesson.id,
    number: lesson.lesson_number,
    title: lesson.title || `Lesson ${lesson.lesson_number}`,
    desc: lesson.lesson_summaries?.recap ?? undefined,
    meta: `${ordinal(lesson.lesson_number)} lesson · ${formatDateShort(lesson.lesson_date)}`,
    score: lesson.lesson_summaries?.score ?? null,
    tag: `Lesson ${lesson.lesson_number}`,
    openHomework: (lesson.homework_items || []).filter((h: any) => !h.completed).length,
  }))

  const progressLessons = rows.map((l: any) => {
    const summary = l.lesson_summaries
    const dist = summary?.vocab_level_distribution
    const distSum = dist && typeof dist === 'object'
      ? Object.values(dist).reduce((a: number, b: any) => a + Number(b), 0)
      : 0
    return {
      lessonNumber: l.lesson_number,
      score: summary?.score ?? null,
      talkPct: summary?.talk_percentage ?? null,
      vocabCount: summary?.vocab_total_count ?? (distSum > 0 ? distSum : (l.vocabulary_items?.length ?? 0)),
    }
  })

  const testList = (tests || []) as any[]

  /* ── Overview ── */
  const overview = (
    <>
      <div style={{ width: '100%' }} data-tour="stats">
        <div className="k-stats" style={{ marginTop: 0 }}>
          <div className="k-stat yellow">
            <div className="k-stat-head"><Icon d="M4 5h16v14H4zM4 9h16M9 9v10" /><span>Lessons</span></div>
            <div className="k-stat-val">
              <b>{lessonCount}</b>
              {recentCount > 0 && <span className="k-chip">+{recentCount}</span>}
            </div>
            <p className="k-stat-sub">{recentCount > 0 ? `${recentCount} in the last 30 days` : 'lessons with Noa so far'}</p>
          </div>
          <div className="k-stat blue">
            <div className="k-stat-head"><Icon d="M12 3v18M5 10l7-7 7 7" /><span>Score</span></div>
            <div className="k-stat-val">
              <b>{avgScore != null ? avgScore.toFixed(1) : '—'}</b>
              {scoreDelta != null && scoreDelta !== 0 && (
                <span className="k-chip">{scoreDelta > 0 ? '▲' : '▼'} {Math.abs(scoreDelta).toFixed(1)}</span>
              )}
            </div>
            <p className="k-stat-sub">average out of 10 · latest {latestScore ?? '—'}</p>
          </div>
          <div className="k-stat purple">
            <div className="k-stat-head"><Icon d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zM5 11a7 7 0 0 0 14 0M12 18v3" /><span>You spoke</span></div>
            <div className="k-stat-val">
              <b>{latestTalk ?? '—'}<span style={{ fontSize: 19 }}>%</span></b>
              {talkDelta != null && talkDelta !== 0 && (
                <span className="k-chip">{talkDelta > 0 ? '▲' : '▼'} {Math.abs(talkDelta)}%</span>
              )}
            </div>
            <p className="k-stat-sub">of the last lesson was you talking</p>
          </div>
        </div>
      </div>

      <div className="k-card" style={{ width: '100%' }} data-tour="milestones">
        <div className="k-card-head"><h3>Your journey</h3><span className="k-link">{getLevelLabel(lessonCount)}</span></div>
        <MilestoneTrack lessonCount={lessonCount} />
      </div>

      {vocabShown > 0 && (
        <div style={{ width: '100%' }} data-tour="vocab">
          <div className="k-sec-head" style={{ margin: '4px 0 12px' }}><h2>Words you have met</h2><span className="k-link">{vocabShown} words</span></div>
          <div className="k-card">
            {hasDistribution
              ? <VocabLevelBreakdown distribution={vocabDistribution} totalCount={totalVocab} />
              : <VocabLevelBreakdown vocab={allVocab} />}
          </div>
        </div>
      )}

      <div style={{ width: '100%' }}>
        <div className="k-sec-head" style={{ margin: '4px 0 12px' }}>
          <h2>Latest lessons</h2>
          <Link href="/student/lessons" className="k-link" data-tour="lessons-link">All {rows.length} →</Link>
        </div>
        <LessonPillar lessons={pillarLessons.slice(0, 4)} />
      </div>
    </>
  )

  /* ── Lessons ── */
  const lessonsTab = (
    <div style={{ width: '100%' }}>
      <div className="k-sec-head" style={{ margin: '4px 0 12px' }}><h2>Your lessons</h2><span className="k-link">{rows.length} in all</span></div>
      <LessonPillar lessons={pillarLessons} />
    </div>
  )

  /* ── Progress ── */
  const progressTab = (
    <>
      <div style={{ width: '100%' }}>
        <div className="k-sec-head" style={{ margin: '4px 0 12px' }}><h2>Lesson by lesson</h2></div>
        {lessonCount >= 2 ? (
          <ProgressCharts lessons={progressLessons} />
        ) : (
          <div className="k-empty">Trends appear once you have two scored lessons.</div>
        )}
      </div>
      {learningMap.length > 0 && (
        <div style={{ width: '100%' }}>
          <div className="k-sec-head" style={{ margin: '4px 0 12px' }}><h2>Japanese learning map</h2></div>
          <JapaneseLearningMapCard categories={learningMap} />
        </div>
      )}
    </>
  )

  /* ── Tests ── */
  const testsTab = (
    <div className="k-card" style={{ width: '100%' }}>
      <div className="k-card-head"><h3>Your tests</h3><span className="k-link">{testList.length}</span></div>
      <div className="k-tests">
        {testList.map((t: any, i: number) => {
          const attempt = Array.isArray(t.test_attempts) ? t.test_attempts[0] : t.test_attempts
          const submitted = !!attempt?.submitted_at
          const inProgress = !!attempt?.started_at && !submitted
          return (
            <Link
              key={t.id}
              href={`/student/tests/${t.id}`}
              data-tour={i === 0 ? 'tests' : undefined}
              className={`k-test${submitted ? ' is-done is-good' : inProgress ? ' is-open' : ''}`}
            >
              <span className="k-test-mark" aria-hidden>{submitted ? '✓' : inProgress ? '…' : '✎'}</span>
              <span className="k-test-body">
                <span className="k-test-title">{t.title}</span>
                <span className="k-test-meta">
                  {t.duration_minutes} min
                  {t.lesson_numbers?.length > 0 ? ` · Lessons ${t.lesson_numbers.join(', ')}` : ''}
                  {` · ${submitted ? 'Submitted' : inProgress ? 'In progress' : formatDateShort(t.created_at)}`}
                </span>
              </span>
              <span className="k-test-cta">{submitted ? 'Results' : inProgress ? 'Resume' : 'Start'}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )

  const tabs = [
    { id: 'overview', label: 'Overview', content: overview },
    { id: 'lessons', label: 'Lessons', content: lessonsTab },
    { id: 'progress', label: 'Progress', content: progressTab },
    ...(testList.length > 0 ? [{ id: 'tests', label: 'Tests', content: testsTab }] : []),
  ]

  return (
    <>
      <StudentTour show={student.tour_completed_at == null} />

      <div className="k-top">
        <div>
          <p className="k-hello">Welcome back to your library</p>
          <h1 className="k-name">{displayName}</h1>
        </div>
      </div>

      <DashboardTabs tabs={tabs} />
    </>
  )
}
