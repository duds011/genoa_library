import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getLevelLabel } from '@/lib/utils'
import ProgressCharts from '@/components/student/ProgressCharts'
import VocabLevelBreakdown from '@/components/student/VocabLevelBreakdown'
import StudentTour from '@/components/student/StudentTour'
import JapaneseLearningMapCard from '@/components/student/JapaneseLearningMapCard'
import { buildJapaneseLearningMap } from '@/lib/japaneseLearningMap'

const MILESTONES = [1, 5, 10, 25, 50]
const MILESTONE_EMOJIS = ['🌱', '🌸', '🌿', '⭐', '🏆']

export default async function StudentDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: student } = await supabase
    .from('students')
    .select('*')
    .eq('profile_id', user.id)
    .single()

  if (!student) {
    return (
      <div className="text-center py-20">
        <p className="text-4xl mb-3">⏳</p>
        <h2 className="font-bold text-ink text-lg">Account not linked yet</h2>
        <p className="text-sm text-muted mt-1">Ask your teacher to link your account.</p>
      </div>
    )
  }

  const displayName = (student.full_name || user.email || 'student').trim().split(/\s+/)[0]

  const { data: lessons } = await supabase
    .from('lessons')
    .select(`
      id, lesson_number, lesson_date, title,
      lesson_summaries ( score, talk_percentage, recap, vocab_level_distribution, vocab_total_count ),
      vocabulary_items ( id, word, jlpt_level ),
      homework_items ( id, completed )
    `)
    .eq('student_id', student.id)
    .eq('status', 'published')
    .order('lesson_number', { ascending: false })

  const { data: learningLessons } = await supabase
    .from('lessons')
    .select(`
      id, lesson_number, title,
      lesson_sections ( title, content )
    `)
    .eq('student_id', student.id)
    .eq('status', 'published')
    .order('lesson_number', { ascending: true })

  // Published tests + this student's attempt state
  const { data: tests } = await supabase
    .from('tests')
    .select('id, title, duration_minutes, lesson_numbers, created_at, test_attempts ( started_at, submitted_at )')
    .eq('student_id', student.id)
    .eq('status', 'published')
    .order('created_at', { ascending: false })

  const lessonCount = (lessons || []).reduce((max: number, l: any) => Math.max(max, l.lesson_number ?? 0), 0)
  const scores = (lessons || []).map((l: any) => l.lesson_summaries?.score).filter(Boolean)
  const latestScore = scores[0] ?? null
  const avgScore = scores.length ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length : null
  const talks = (lessons || []).map((l: any) => l.lesson_summaries?.talk_percentage).filter(Boolean)
  const latestTalk = talks[0] ?? null
  const firstTalk = talks[talks.length - 1] ?? null
  const talkDelta = latestTalk && firstTalk ? latestTalk - firstTalk : null
  // Aggregate vocab_level_distribution from all lessons (full GPT-detected counts, not just 10 key words)
  const vocabDistribution: Record<string, number> = {}
  for (const lesson of lessons || []) {
    const dist = (lesson.lesson_summaries as any)?.vocab_level_distribution
    if (dist && typeof dist === 'object') {
      for (const [level, count] of Object.entries(dist)) {
        vocabDistribution[level] = (vocabDistribution[level] ?? 0) + (count as number)
      }
    }
  }
  const totalVocab = Object.values(vocabDistribution).reduce((sum, n) => sum + n, 0)
  // Keep allVocab for lessons that predate the distribution field (fallback)
  const allVocabRaw = (lessons || []).flatMap((l: any) => l.vocabulary_items || [])
  const seenWords = new Set<string>()
  const allVocab = allVocabRaw.filter((v: any) => {
    if (!v.jlpt_level) return false
    const key = (v.word ?? '').trim().toLowerCase()
    if (!key || seenWords.has(key)) return false
    seenWords.add(key)
    return true
  })
  const hasDistribution = totalVocab > 0
  const firstScore = scores[scores.length - 1]
  const scoreDelta = latestScore && firstScore
    ? (latestScore - firstScore >= 0 ? '+' : '') + (latestScore - firstScore).toFixed(1)
    : '+0.0'
  const nextMilestone = MILESTONES.find(m => m > lessonCount) ?? 50
  const levelLabel = getLevelLabel(lessonCount)

  const learningMap = buildJapaneseLearningMap((learningLessons || []) as any)

  return (
    <div className="space-y-6">
      {/* First login only — Noa's new students get a walkthrough of the portal.
          Null tour_completed_at means they have never finished it. */}
      <StudentTour show={student.tour_completed_at == null} />

      {/* Header */}
      <div className="card p-4 sm:p-5" style={{ background: 'linear-gradient(180deg,#ffffff 0%,#f6f5ff 100%)' }}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 px-3 py-1 bg-brand-50 rounded-full w-fit mb-1">
              <span className="w-2 h-2 rounded-full bg-brand-600 animate-pulse" />
              <span className="text-xs font-semibold text-brand-600">Student View</span>
            </div>
            <style>{`
              @keyframes genoaShift{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
              .genoa-animated{background:linear-gradient(270deg,#7c3aed,#a855f7,#facc15,#7c3aed);background-size:400% 400%;animation:genoaShift 6s ease infinite;-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;}
            `}</style>
            <h1 className="genoa-animated text-2xl sm:text-3xl font-extrabold mt-2">
              GENOA Library
            </h1>
            <p className="text-sm text-muted mt-0.5">
              Welcome, <strong className="text-ink">{displayName}</strong>.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href="/student/lessons" className="btn-primary px-4 py-2 text-xs" data-tour="lessons-link">
              View lessons
            </Link>
            {(tests?.length ?? 0) > 0 && (
              <a href="#tests" className="btn-secondary px-4 py-2 text-xs">
                View tests
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Progress stats */}
      <div data-tour="stats">
        <h2 className="text-xs font-bold text-ink mb-2 uppercase tracking-wide">Your Progress</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="card px-4 py-3 flex flex-col gap-0.5">
            <span className="stat-label">Lessons</span>
            <span className="text-xl font-bold leading-tight" style={{ color: '#4f46e5' }}>{lessonCount}</span>
          </div>
          <div className="card px-4 py-3 flex flex-col gap-0.5">
            <span className="stat-label">Latest Score</span>
            <div className="flex flex-col">
              <span className="text-xl font-bold leading-tight" style={{ color: '#4f46e5' }}>
                {latestScore ?? '—'}<span className="text-sm font-normal text-muted">/10</span>
              </span>
              <span className="text-xs text-muted">{scoreDelta} since lesson 1</span>
            </div>
          </div>
          <div className="card px-4 py-3 flex flex-col gap-0.5">
            <span className="stat-label">Avg Score</span>
            <span className="text-xl font-bold leading-tight" style={{ color: '#4f46e5' }}>
              {avgScore ? avgScore.toFixed(1) : '—'}<span className="text-sm font-normal text-muted">/10</span>
            </span>
          </div>
          <div className="card px-4 py-3 flex flex-col gap-0.5">
            <span className="stat-label">You Talk</span>
            <div className="flex flex-col">
              <span className="text-xl font-bold leading-tight" style={{ color: '#4f46e5' }}>
                {latestTalk ?? '—'}<span className="text-sm font-normal text-muted">%</span>
              </span>
              {talkDelta !== null && (
                <span className="text-xs text-muted">{talkDelta >= 0 ? '+' : ''}{talkDelta}% since lesson 1</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Progress charts sit directly under the stat row and open by default.
          Collapsed at the bottom of the page, below the learning map, students
          simply never found them. */}
      {lessonCount >= 2 && (
        <ProgressCharts
          lessons={(lessons || []).map((l: any) => {
            // Use the full GPT-detected vocab count (same source as the vocab profile),
            // not just the ~10 key words Noa curates per lesson.
            const summary = l.lesson_summaries
            const dist = summary?.vocab_level_distribution
            const distSum = dist && typeof dist === 'object'
              ? Object.values(dist).reduce((a: number, b: any) => a + Number(b), 0)
              : 0
            const vocabCount = summary?.vocab_total_count ?? (distSum > 0 ? distSum : (l.vocabulary_items?.length ?? 0))
            return {
              lessonNumber: l.lesson_number,
              score: summary?.score ?? null,
              talkPct: summary?.talk_percentage ?? null,
              vocabCount,
            }
          })}
        />
      )}

      {/* Milestone progress */}
      <div className="card px-4 py-3" data-tour="milestones">
        <div className="relative px-3" style={{ paddingTop: '1.7rem', paddingBottom: '1.05rem' }}>
          <div className="relative h-1 bg-gray-200 rounded-full">
            <div
              className="absolute h-full rounded-full transition-all duration-700"
              style={{ width: `${Math.min((lessonCount / 50) * 100, 100)}%`, background: 'linear-gradient(90deg, #4f46e5, #7c3aed)' }}
            />
            {MILESTONES.map((m, i) => {
              const pct = (m / 50) * 100
              const reached = lessonCount >= m
              return (
                <div key={m} className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2" style={{ left: `${pct}%` }}>
                  <span className="absolute text-sm" style={{ bottom: '14px', left: '50%', transform: 'translateX(-50%)', lineHeight: 1 }}>
                    {MILESTONE_EMOJIS[i]}
                  </span>
                  <div className={`w-3 h-3 rounded-full border-2 transition-colors ${reached ? 'bg-brand-600 border-brand-600' : 'bg-white border-gray-300'}`} />
                  <span className="absolute text-[10px] text-muted font-medium" style={{ top: '12px', left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}>
                    {m}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
        <p className="text-xs text-muted text-center">
          {nextMilestone > lessonCount
            ? `${nextMilestone - lessonCount} more lesson${nextMilestone - lessonCount !== 1 ? 's' : ''} to unlock ${MILESTONE_EMOJIS[MILESTONES.indexOf(nextMilestone)]} ${levelLabel}`
            : '🏆 Maximum milestone reached!'}
        </p>
      </div>

      {/* Vocabulary profile. This used to sit under a second card repeating the
          same total and the same per-level counts — one is enough. */}
      {totalVocab > 0 && (
        <div data-tour="vocab">
          {hasDistribution
            ? <VocabLevelBreakdown distribution={vocabDistribution} totalCount={totalVocab} />
            : <VocabLevelBreakdown vocab={allVocab} />}
        </div>
      )}

      <JapaneseLearningMapCard categories={learningMap} />

      {/* Tests / Evaluations */}
      {(tests?.length ?? 0) > 0 && (
        <section id="tests">
          <h2 className="text-sm font-bold text-ink mb-3 uppercase tracking-wide">Your Tests</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {(tests || []).map((t: any, i: number) => {
              const attempt = Array.isArray(t.test_attempts) ? t.test_attempts[0] : t.test_attempts
              const submitted = !!attempt?.submitted_at
              const inProgress = !!attempt?.started_at && !submitted
              return (
                <Link
                  key={t.id}
                  href={`/student/tests/${t.id}`}
                  data-tour={i === 0 ? 'tests' : undefined}
                  className="card p-5 flex flex-col gap-3 hover:border-brand-200 hover:shadow-md transition-all"
                  style={{ background: 'linear-gradient(180deg,#ffffff 0%,#f6f5ff 100%)' }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="badge-brand text-xs">📝 Test</span>
                    <span className={`text-[10px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5 ${
                      submitted ? 'text-green-600 bg-green-50 border border-green-100'
                      : inProgress ? 'text-orange-600 bg-orange-50 border border-orange-100'
                      : 'text-brand-600 bg-brand-50 border border-indigo-100'
                    }`}>
                      {submitted ? 'Submitted' : inProgress ? 'In progress' : 'Not started'}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-bold text-ink text-base leading-snug">{t.title}</h3>
                    <p className="text-xs text-muted mt-0.5">
                      ⏱️ {t.duration_minutes} min{t.lesson_numbers?.length > 0 ? ` • Lessons ${t.lesson_numbers.join(', ')}` : ''}
                    </p>
                  </div>
                  <button className="btn-primary w-full justify-center mt-auto">
                    {submitted ? 'View results →' : inProgress ? 'Resume test →' : 'Start test →'}
                  </button>
                </Link>
              )
            })}
          </div>
        </section>
      )}

    </div>
  )
}
