import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatDateShort, getLevelLabel, ordinal } from '@/lib/utils'
import ProgressCharts from '@/components/student/ProgressCharts'
import VocabLevelBreakdown, { JLPT_COLORS } from '@/components/student/VocabLevelBreakdown'

const MILESTONES = [1, 5, 10, 25, 50]
const MILESTONE_EMOJIS = ['🌱', '🌸', '🌿', '⭐', '🏆']
const JLPT_LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1']

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

  const { data: lessons } = await supabase
    .from('lessons')
    .select(`
      id, lesson_number, lesson_date, title,
      lesson_summaries ( score, talk_percentage, recap ),
      vocabulary_items ( id, word, jlpt_level ),
      homework_items ( id, completed )
    `)
    .eq('student_id', student.id)
    .eq('status', 'published')
    .order('lesson_number', { ascending: false })

  const lessonCount = (lessons || []).reduce((max: number, l: any) => Math.max(max, l.lesson_number ?? 0), 0)
  const scores = (lessons || []).map((l: any) => l.lesson_summaries?.score).filter(Boolean)
  const latestScore = scores[0] ?? null
  const avgScore = scores.length ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length : null
  const talks = (lessons || []).map((l: any) => l.lesson_summaries?.talk_percentage).filter(Boolean)
  const latestTalk = talks[0] ?? null
  const firstTalk = talks[talks.length - 1] ?? null
  const talkDelta = latestTalk && firstTalk ? latestTalk - firstTalk : null
  // Flatten all vocab, keep only items with a JLPT level, deduplicate by word
  const allVocabRaw = (lessons || []).flatMap((l: any) => l.vocabulary_items || [])
  const seenWords = new Set<string>()
  const allVocab = allVocabRaw.filter((v: any) => {
    if (!v.jlpt_level) return false
    const key = (v.word ?? '').trim().toLowerCase()
    if (!key || seenWords.has(key)) return false
    seenWords.add(key)
    return true
  })
  const totalVocab = allVocab.length
  const firstScore = scores[scores.length - 1]
  const scoreDelta = latestScore && firstScore
    ? (latestScore - firstScore >= 0 ? '+' : '') + (latestScore - firstScore).toFixed(1)
    : '+0.0'
  const nextMilestone = MILESTONES.find(m => m > lessonCount) ?? 50
  const levelLabel = getLevelLabel(lessonCount)

  // JLPT counts for inline badges
  const jlptCounts = JLPT_LEVELS.map(level => ({
    level,
    count: allVocab.filter((v: any) => v.jlpt_level === level).length,
  })).filter(c => c.count > 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card p-6" style={{ background: 'linear-gradient(180deg,#ffffff 0%,#f6f5ff 100%)' }}>
        <div className="flex items-center gap-2 px-3 py-1 bg-brand-50 rounded-full w-fit mb-1">
          <span className="w-2 h-2 rounded-full bg-brand-600 animate-pulse" />
          <span className="text-xs font-semibold text-brand-600">Student View</span>
        </div>
        <style>{`
          @keyframes genoaShift{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
          .genoa-animated{background:linear-gradient(270deg,#7c3aed,#a855f7,#facc15,#7c3aed);background-size:400% 400%;animation:genoaShift 6s ease infinite;-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;}
        `}</style>
        <h1 className="genoa-animated text-3xl font-extrabold mt-3">
          GENOA Library
        </h1>
        <p className="text-sm text-muted mt-0.5">
          Welcome, <strong className="text-ink">{user.email}</strong>. Your lessons are shown below.
        </p>
      </div>

      {/* Progress stats */}
      <div>
        <h2 className="text-sm font-bold text-ink mb-3 uppercase tracking-wide">Your Progress</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="stat-card">
            <span className="stat-label">Lessons</span>
            <span className="stat-value" style={{ color: '#4f46e5' }}>{lessonCount}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Latest Score</span>
            <div className="flex flex-col">
              <span className="stat-value" style={{ color: '#4f46e5' }}>
                {latestScore ?? '—'}<span className="text-base font-normal text-muted">/10</span>
              </span>
              <span className="text-xs text-muted">{scoreDelta} since lesson 1</span>
            </div>
          </div>
          <div className="stat-card">
            <span className="stat-label">Avg Score</span>
            <span className="stat-value" style={{ color: '#4f46e5' }}>
              {avgScore ? avgScore.toFixed(1) : '—'}<span className="text-base font-normal text-muted">/10</span>
            </span>
          </div>
          <div className="stat-card">
            <span className="stat-label">You Talk</span>
            <div className="flex flex-col">
              <span className="stat-value" style={{ color: '#4f46e5' }}>
                {latestTalk ?? '—'}<span className="text-base font-normal text-muted">%</span>
              </span>
              {talkDelta !== null && (
                <span className="text-xs text-muted">{talkDelta >= 0 ? '+' : ''}{talkDelta}% since lesson 1</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Milestone progress — directly under stats */}
      <div className="card p-5">
        <div className="relative px-3" style={{ paddingTop: '2.5rem', paddingBottom: '1.75rem' }}>
          <div className="relative h-1.5 bg-gray-200 rounded-full">
            <div
              className="absolute h-full rounded-full transition-all duration-700"
              style={{ width: `${Math.min((lessonCount / 50) * 100, 100)}%`, background: 'linear-gradient(90deg, #4f46e5, #7c3aed)' }}
            />
            {MILESTONES.map((m, i) => {
              const pct = (m / 50) * 100
              const reached = lessonCount >= m
              return (
                <div key={m} className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2" style={{ left: `${pct}%` }}>
                  <span className="absolute text-base" style={{ bottom: '18px', left: '50%', transform: 'translateX(-50%)', lineHeight: 1 }}>
                    {MILESTONE_EMOJIS[i]}
                  </span>
                  <div className={`w-3.5 h-3.5 rounded-full border-2 transition-colors ${reached ? 'bg-brand-600 border-brand-600' : 'bg-white border-gray-300'}`} />
                  <span className="absolute text-[10px] text-muted font-medium" style={{ top: '14px', left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}>
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

      {/* Words learned + JLPT badges inline */}
      {totalVocab > 0 && (
        <div className="card px-5 py-4 flex items-center gap-3 flex-wrap">
          <span className="text-xl">📚</span>
          <span className="font-bold text-ink">{totalVocab} vocabulary items covered</span>
          <div className="flex items-center gap-2 flex-wrap">
            {jlptCounts.map(({ level, count }) => (
              <span
                key={level}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold"
                style={{
                  background: (JLPT_COLORS[level] ?? '#818cf8') + '18',
                  color: JLPT_COLORS[level] ?? '#818cf8',
                  border: `1px solid ${(JLPT_COLORS[level] ?? '#818cf8')}35`,
                }}
              >
                {level} {count}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Vocab level bar */}
      {totalVocab > 0 && <VocabLevelBreakdown vocab={allVocab} />}

      {/* Collapsible progress charts */}
      {lessonCount >= 2 && (
        <ProgressCharts
          lessons={(lessons || []).map((l: any) => ({
            lessonNumber: l.lesson_number,
            score: l.lesson_summaries?.score ?? null,
            talkPct: l.lesson_summaries?.talk_percentage ?? null,
            vocabCount: l.vocabulary_items?.length ?? 0,
          }))}
        />
      )}

      {/* Lessons */}
      <section>
        <div className="grid sm:grid-cols-2 gap-4">
          {(lessons || []).map((lesson: any) => (
            <Link
              key={lesson.id}
              href={`/student/lessons/${lesson.id}`}
              className="card p-5 flex flex-col gap-3 hover:border-brand-200 hover:shadow-md transition-all"
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
                <h3 className="font-bold text-ink text-base leading-snug">
                  {lesson.title || `Lesson ${lesson.lesson_number}`}
                </h3>
                <p className="text-xs text-muted mt-0.5">{ordinal(lesson.lesson_number)} lesson • {formatDateShort(lesson.lesson_date)}</p>
              </div>
              {lesson.lesson_summaries?.recap && (
                <p className="text-sm text-muted line-clamp-2">{lesson.lesson_summaries.recap}</p>
              )}
              <button className="btn-primary w-full justify-center mt-auto">
                Open Lesson →
              </button>
            </Link>
          ))}

          {lessonCount === 0 && (
            <div className="col-span-2 card p-12 text-center">
              <p className="text-4xl mb-3">📖</p>
              <p className="font-semibold text-ink">No lessons yet</p>
              <p className="text-sm text-muted mt-1">Your lessons will appear here once published by your teacher.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
