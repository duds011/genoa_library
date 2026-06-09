import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { formatDateShort, getLevelLabel, ordinal } from '@/lib/utils'
import StudentProgressChart from '@/components/teacher/StudentProgressChart'
import VocabLevelBreakdown from '@/components/student/VocabLevelBreakdown'
import ResetPasswordButton from '@/components/teacher/ResetPasswordButton'
import UpdateEmailButton from '@/components/teacher/UpdateEmailButton'
import { PenLine, BookOpen, ArrowLeft } from 'lucide-react'
import DeleteLessonButton from '@/components/teacher/DeleteLessonButton'

const MILESTONES = [1, 5, 10, 25, 50]
const MILESTONE_EMOJIS = ['🌱', '🌸', '🌿', '⭐', '🏆']

export default async function StudentDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = await createClient()

  const { data: student } = await supabase
    .from('students')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!student) notFound()

  const { data: lessons } = await supabase
    .from('lessons')
    .select(`
      id, lesson_number, lesson_date, status, title,
      lesson_summaries ( score, talk_percentage, recap, vocab_level_distribution ),
      vocabulary_items ( id, jlpt_level ),
      homework_items ( id, completed )
    `)
    .eq('student_id', params.id)
    .order('lesson_number', { ascending: true })

  const published = (lessons || []).filter((l: any) => l.status === 'published')
  const drafts    = (lessons || []).filter((l: any) => l.status === 'draft')

  // Find which lessons have unreviewed homework or audio submissions
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
  const firstScore  = scores[0] ?? null
  const avgScore    = scores.length ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length : null
  const scoreDelta  = latestScore && firstScore
    ? (latestScore - firstScore >= 0 ? '+' : '') + (latestScore - firstScore).toFixed(1)
    : null

  const talks      = published.map((l: any) => l.lesson_summaries?.talk_percentage).filter(Boolean)
  const latestTalk = talks[talks.length - 1] ?? null
  const firstTalk  = talks[0] ?? null
  const talkDelta  = latestTalk && firstTalk ? latestTalk - firstTalk : null

  // Aggregate vocab_level_distribution (full GPT-detected vocab) — same source as student dashboard
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

  // Fallback: count vocabulary_items rows with a jlpt_level (for older lessons)
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

  const lessonCount   = published.reduce((max: number, l: any) => Math.max(max, l.lesson_number ?? 0), 0)
  const nextMilestone = MILESTONES.find(m => m > lessonCount) ?? 50
  const levelLabel    = getLevelLabel(lessonCount)

  const chartData = published.map((l: any) => ({
    lesson: `L${l.lesson_number}`,
    score: l.lesson_summaries?.score ?? null,
    talk:  l.lesson_summaries?.talk_percentage ?? null,
  }))

  return (
    <div className="space-y-8">
      {/* Back + header */}
      <div>
        <Link href="/teacher/students" className="btn-ghost text-xs mb-3 -ml-1 inline-flex">
          <ArrowLeft className="w-3.5 h-3.5" /> All Students
        </Link>
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-xl font-bold"
            style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}>
            {student.full_name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-ink">{student.full_name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="badge-brand">{student.language}</span>
              <span className="badge text-xs bg-gray-100 text-muted">{student.level}</span>
              <span className="text-xs text-muted">{student.email}</span>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2 flex-wrap justify-end">
            {drafts.length > 0 && (
              <span className="badge-draft">{drafts.length} draft{drafts.length > 1 ? 's' : ''} pending</span>
            )}
            <UpdateEmailButton studentId={student.id} currentEmail={student.email} />
            {student.profile_id && <ResetPasswordButton studentId={student.id} />}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="stat-card">
          <span className="stat-label">Lessons</span>
          <span className="stat-value">{lessonCount}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Latest Score</span>
          <div className="flex flex-col">
            <span className="stat-value text-brand-600">{latestScore ?? '—'}<span className="text-sm font-normal text-muted">/10</span></span>
            {scoreDelta && <span className="text-xs text-muted">{scoreDelta} since lesson 1</span>}
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-label">Avg Score</span>
          <span className="stat-value">{avgScore ? avgScore.toFixed(1) : '—'}<span className="text-sm font-normal text-muted">/10</span></span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Student Talks</span>
          <div className="flex flex-col">
            <span className="stat-value">{latestTalk ?? '—'}<span className="text-sm font-normal text-muted">%</span></span>
            {talkDelta !== null && <span className="text-xs text-muted">{talkDelta >= 0 ? '+' : ''}{talkDelta}% since lesson 1</span>}
          </div>
        </div>
      </div>

      {/* Progress chart */}
      {chartData.length > 1 && (
        <div className="card p-6">
          <h2 className="section-title mb-4">Progress Over Time</h2>
          <StudentProgressChart data={chartData} />
        </div>
      )}

      {/* Words learned + vocab breakdown */}
      {totalVocab > 0 && (
        <>
          <div className="card px-5 py-4 flex items-center gap-3">
            <span className="text-xl">📚</span>
            <span className="font-bold text-ink">{totalVocab} vocabulary items covered across {lessonCount} lessons</span>
          </div>
          {hasDistribution
            ? <VocabLevelBreakdown distribution={vocabDistribution} totalCount={totalVocab} />
            : <VocabLevelBreakdown vocab={allVocab} />
          }
        </>
      )}

      {/* Milestone progress */}
      <div className="card p-5">
        <h2 className="section-title mb-4">Lesson Milestones</h2>
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
              const pct     = (m / 50) * 100
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

      {/* Pending drafts */}
      {drafts.length > 0 && (
        <section>
          <h2 className="section-title mb-3">⏳ Pending Review ({drafts.length})</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {drafts.map((lesson: any) => (
              <div key={lesson.id} className="card p-5 border-orange-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="badge-draft">Draft</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted">{formatDateShort(lesson.lesson_date)}</span>
                    <DeleteLessonButton lessonId={lesson.id} lessonLabel={`Lesson ${lesson.lesson_number}`} variant="icon" />
                  </div>
                </div>
                <p className="font-semibold text-ink mb-3">{lesson.title || `Lesson ${lesson.lesson_number}`}</p>
                <Link href={`/teacher/lessons/${lesson.id}/edit`} className="btn-primary w-full justify-center">
                  <PenLine className="w-3.5 h-3.5" /> Review & Edit
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Published lessons */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="w-4 h-4 text-brand-600" />
          <h2 className="section-title">Published Lessons</h2>
        </div>
        {published.length === 0 ? (
          <div className="card p-8 text-center text-muted text-sm">No published lessons yet.</div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wide">#</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wide">Date</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wide">Score</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wide">Talk %</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wide">Words</th>
                  <th className="text-right px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {published.map((lesson: any) => {
                  const hasUpdate = lessonsWithUpdates.has(lesson.id)
                  return (
                    <tr key={lesson.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-5 py-3 font-semibold text-ink">
                        <div className="flex items-center gap-2">
                          {lesson.lesson_number}
                          {hasUpdate && (
                            <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" title="New submission" />
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-muted">{formatDateShort(lesson.lesson_date)}</td>
                      <td className="px-5 py-3">
                        <span className="font-semibold text-brand-600">{lesson.lesson_summaries?.score ?? '—'}</span>
                        <span className="text-muted">/10</span>
                      </td>
                      <td className="px-5 py-3 text-muted">{lesson.lesson_summaries?.talk_percentage ?? '—'}%</td>
                      <td className="px-5 py-3 text-muted">{lesson.vocabulary_items?.length ?? 0}</td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link href={`/teacher/lessons/${lesson.id}/edit`} className="btn-ghost text-xs">Edit</Link>
                          <DeleteLessonButton lessonId={lesson.id} lessonLabel={`Lesson ${lesson.lesson_number}`} variant="row" />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
