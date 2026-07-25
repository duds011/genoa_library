import { createClient, getUser } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { formatDateShort, getLevelEmoji, getLevelLabel, ordinal } from '@/lib/utils'
import ProgressCharts from '@/components/student/ProgressCharts'
import VocabLevelBreakdown from '@/components/student/VocabLevelBreakdown'

const MILESTONES = [1, 5, 10, 25, 50]
const MILESTONE_EMOJIS = ['ðŸŒ±', 'ðŸŒ¸', 'ðŸŒ¿', 'â­', 'ðŸ†']

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
      lesson_summaries ( score, talk_percentage, recap ),
      vocabulary_items ( id, jlpt_level ),
      homework_items ( id, completed )
    `)
    .eq('student_id', student.id)
    .eq('status', 'published')
    .order('lesson_number', { ascending: false })

  const lessonCount = lessons?.length ?? 0
  const scores = (lessons || []).map((l: any) => l.lesson_summaries?.score).filter(Boolean)
  const latestScore = scores[0] ?? null
  const avgScore = scores.length
    ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length
    : null
  const talks = (lessons || []).map((l: any) => l.lesson_summaries?.talk_percentage).filter(Boolean)
  const latestTalk = talks[0] ?? null
  const firstTalk = talks[talks.length - 1] ?? null
  const talkDelta = latestTalk && firstTalk ? latestTalk - firstTalk : null
  const totalVocab = (lessons || []).reduce((acc: number, l: any) => acc + (l.vocabulary_items?.length ?? 0), 0)
  const allVocab = (lessons || []).flatMap((l: any) => l.vocabulary_items || [])
  const firstScore = scores[scores.length - 1]
  const scoreDelta = latestScore && firstScore
    ? (latestScore - firstScore >= 0 ? '+' : '') + (latestScore - firstScore).toFixed(1)
    : '+0.0'
  const nextMilestone = MILESTONES.find(m => m > lessonCount) ?? 50
  const levelLabel = getLevelLabel(lessonCount)

  return (
    <div className="space-y-6">
      {/* Teacher preview banner */}
      <div className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200">
        <div className="flex items-center gap-2.5">
          <span className="text-lg">ðŸ‘</span>
          <div>
            <p className="text-sm font-bold text-amber-800">Teacher Preview</p>
            <p className="text-xs text-amber-600">You're viewing {student.full_name}'s student dashboard</p>
          </div>
        </div>
        <Link href={`/teacher/students/${params.id}`} className="btn-ghost text-xs shrink-0">
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </Link>
      </div>

      {/* Header â€” mirrors student view */}
      <div className="card p-6">
        <div className="flex items-center gap-2 px-3 py-1 bg-brand-50 rounded-full w-fit">
          <span className="w-2 h-2 rounded-full bg-brand-600 animate-pulse" />
          <span className="text-xs font-semibold text-brand-600">Student View</span>
        </div>
        <h1 className="text-3xl font-extrabold mt-3" style={{ color: '#4f46e5' }}>
          Language Library
        </h1>
        <p className="text-sm text-muted mt-0.5">
          Welcome, <strong className="text-ink">{student.full_name}</strong>. Your lessons are shown below.
        </p>
      </div>

      {/* Progress stats */}
      <div>
        <h2 className="text-sm font-bold text-ink mb-3 uppercase tracking-wide">Your Progress</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="stat-card">
            <span className="stat-label">Lessons</span>
            <span className="stat-value">{lessonCount}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Latest Score</span>
            <div className="flex flex-col">
              <span className="stat-value">{latestScore ?? 'â€”'}<span className="text-base font-normal text-muted">/10</span></span>
              <span className="text-xs text-muted">{scoreDelta} since lesson 1</span>
            </div>
          </div>
          <div className="stat-card">
            <span className="stat-label">Avg Score</span>
            <span className="stat-value">{avgScore ? avgScore.toFixed(1) : 'â€”'}<span className="text-base font-normal text-muted">/10</span></span>
          </div>
          <div className="stat-card">
            <span className="stat-label">You Talk</span>
            <div className="flex flex-col">
              <span className="stat-value">{latestTalk ?? 'â€”'}<span className="text-base font-normal text-muted">%</span></span>
              {talkDelta !== null && (
                <span className="text-xs text-muted">{talkDelta >= 0 ? '+' : ''}{talkDelta}% since lesson 1</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Progress charts */}
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

      {/* Words learned */}
      <div className="card px-5 py-4 flex items-center gap-3">
        <span className="text-xl">ðŸ“š</span>
        <span className="font-bold text-ink">{totalVocab} vocabulary items covered</span>
        {totalVocab > 0 && <span className="badge-green ml-1">{totalVocab} total</span>}
      </div>

      {totalVocab > 0 && <VocabLevelBreakdown vocab={allVocab} />}

      {/* Milestone progress */}
      <div className="card p-5">
        <div className="relative px-3" style={{ paddingTop: '2.5rem', paddingBottom: '1.75rem' }}>
          <div className="relative h-1.5 bg-gray-200 rounded-full">
            <div
              className="absolute h-full rounded-full transition-all duration-700"
              style={{
                width: `${Math.min((lessonCount / 50) * 100, 100)}%`,
                background: 'linear-gradient(90deg, #4f46e5, #7c3aed)',
              }}
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
            : 'ðŸ† Maximum milestone reached!'}
        </p>
      </div>

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
                  <span className="text-xs font-bold text-brand-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                    {lesson.lesson_summaries.score}/10
                  </span>
                )}
              </div>
              <div>
                <h3 className="font-bold text-ink text-base leading-snug">
                  {lesson.title || `Lesson ${lesson.lesson_number}`}
                </h3>
                <p className="text-xs text-muted mt-0.5">{ordinal(lesson.lesson_number)} lesson â€¢ {formatDateShort(lesson.lesson_date)}</p>
              </div>
              {lesson.lesson_summaries?.recap && (
                <p className="text-sm text-muted line-clamp-2">{lesson.lesson_summaries.recap}</p>
              )}
              <div className="btn-primary w-full justify-center mt-auto">Open Lesson â†’</div>
            </Link>
          ))}

          {lessonCount === 0 && (
            <div className="col-span-2 card p-12 text-center">
              <p className="text-4xl mb-3">ðŸ“–</p>
              <p className="font-semibold text-ink">No published lessons yet</p>
              <p className="text-sm text-muted mt-1">Publish a lesson to see it here.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
