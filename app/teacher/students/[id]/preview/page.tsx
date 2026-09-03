import { createClient, getUser } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { formatDateShort, getLevelLabel, ordinal } from '@/lib/utils'
import ProgressCharts from '@/components/student/ProgressCharts'
import VocabLevelBreakdown from '@/components/student/VocabLevelBreakdown'
import LessonPillar, { type PillarLesson } from '@/components/student/LessonPillar'
import MilestoneTrack from '@/components/MilestoneTrack'

const Icon = ({ d }: { d: string }) => (
  <svg className="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
)

/**
 * What the student sees, for the teacher — the same blocks the student
 * dashboard's Overview tab is built from, inside the teacher shell, behind a
 * banner saying whose it is.
 */
export default async function StudentPreviewPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = await createClient()
  const user = await getUser() // memoized, shared with the layout
  if (!user) notFound()

  const admin = createAdminClient()

  const { data: student } = await admin
    .from('students')
    .select('*')
    .eq('id', params.id)
    .eq('teacher_id', user.id)
    .single()

  if (!student) notFound()

  const { data: lessons } = await admin
    .from('lessons')
    .select(`
      id, lesson_number, lesson_date, title,
      lesson_summaries ( score, talk_percentage, recap, vocab_level_distribution, vocab_total_count ),
      vocabulary_items ( id, jlpt_level ),
      homework_items ( id, completed )
    `)
    .eq('student_id', student.id)
    .eq('status', 'published')
    .order('lesson_number', { ascending: false })

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
  const allVocab = rows.flatMap((l: any) => l.vocabulary_items || []).filter((v: any) => v.jlpt_level)

  const pillar: PillarLesson[] = rows.map((lesson) => ({
    id: lesson.id,
    number: lesson.lesson_number,
    title: lesson.title || `Lesson ${lesson.lesson_number}`,
    desc: lesson.lesson_summaries?.recap ?? undefined,
    meta: `${ordinal(lesson.lesson_number)} lesson · ${formatDateShort(lesson.lesson_date)}`,
    score: lesson.lesson_summaries?.score ?? null,
    tag: `Lesson ${lesson.lesson_number}`,
    openHomework: (lesson.homework_items || []).filter((h: any) => !h.completed).length,
  }))

  const firstName = student.full_name.split(' ')[0]

  return (
    <div className="k-page" style={{ display: 'grid', gap: 16, maxWidth: 980 }}>
      <div className="system-banner" style={{ marginBottom: 0 }}>
        <span><strong>Student view.</strong> This is {student.full_name}&rsquo;s dashboard as they see it.</span>
        <Link href={`/teacher/students/${params.id}`} className="btn btn-ghost btn-sm">← Back to {firstName}</Link>
      </div>

      <div className="k-top" style={{ marginBottom: 4 }}>
        <div>
          <p className="k-hello">Welcome back to your library</p>
          <h1 className="k-name">{firstName}</h1>
        </div>
      </div>

      <div className="k-stats" style={{ marginTop: 0 }}>
        <div className="k-stat yellow">
          <div className="k-stat-head"><Icon d="M4 5h16v14H4zM4 9h16M9 9v10" /><span>Lessons</span></div>
          <div className="k-stat-val"><b>{lessonCount}</b></div>
          <p className="k-stat-sub">lessons with Noa so far</p>
        </div>
        <div className="k-stat blue">
          <div className="k-stat-head"><Icon d="M12 3v18M5 10l7-7 7 7" /><span>Score</span></div>
          <div className="k-stat-val">
            <b>{avgScore != null ? avgScore.toFixed(1) : '—'}</b>
            {scoreDelta != null && scoreDelta !== 0 && <span className="k-chip">{scoreDelta > 0 ? '▲' : '▼'} {Math.abs(scoreDelta).toFixed(1)}</span>}
          </div>
          <p className="k-stat-sub">average out of 10 · latest {latestScore ?? '—'}</p>
        </div>
        <div className="k-stat purple">
          <div className="k-stat-head"><Icon d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zM5 11a7 7 0 0 0 14 0M12 18v3" /><span>You spoke</span></div>
          <div className="k-stat-val">
            <b>{latestTalk ?? '—'}<span style={{ fontSize: 19 }}>%</span></b>
            {talkDelta != null && talkDelta !== 0 && <span className="k-chip">{talkDelta > 0 ? '▲' : '▼'} {Math.abs(talkDelta)}%</span>}
          </div>
          <p className="k-stat-sub">of the last lesson was you talking</p>
        </div>
      </div>

      <div className="k-card">
        <div className="k-card-head"><h3>Your journey</h3><span className="k-link">{getLevelLabel(lessonCount)}</span></div>
        <MilestoneTrack lessonCount={lessonCount} />
      </div>

      {lessonCount >= 2 && (
        <ProgressCharts
          lessons={rows.map((l: any) => ({
            lessonNumber: l.lesson_number,
            score: l.lesson_summaries?.score ?? null,
            talkPct: l.lesson_summaries?.talk_percentage ?? null,
            vocabCount: l.lesson_summaries?.vocab_total_count ?? (l.vocabulary_items?.length ?? 0),
          }))}
        />
      )}

      {(totalVocab > 0 || allVocab.length > 0) && (
        <div className="k-card">
          <div className="k-card-head"><h3>Words you have met</h3><span className="k-link">{totalVocab || allVocab.length} words</span></div>
          {totalVocab > 0
            ? <VocabLevelBreakdown distribution={vocabDistribution} totalCount={totalVocab} />
            : <VocabLevelBreakdown vocab={allVocab} />}
        </div>
      )}

      <div>
        <div className="k-sec-head" style={{ margin: '4px 0 12px' }}><h2>Lessons</h2><span className="k-link">{rows.length} in all</span></div>
        <LessonPillar lessons={pillar} />
      </div>
    </div>
  )
}
