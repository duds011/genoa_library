import { createClient } from '@/lib/supabase/server'
import { BarChart2 } from 'lucide-react'
import ClassAnalyticsCharts, { SummaryItem } from '@/components/teacher/ClassAnalyticsCharts'

export default async function AnalyticsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: lessonData } = await supabase
    .from('lessons')
    .select(`
      student_id, lesson_number,
      students ( full_name ),
      lesson_summaries ( score, talk_percentage )
    `)
    .eq('teacher_id', user!.id)
    .eq('status', 'published')
    .not('student_id', 'is', null)
    .order('lesson_number', { ascending: true })

  // ── Collect raw per-student data ──────────────────────────────────────────
  type RawEntry = {
    name: string
    scores: number[]
    talks: number[]
    lessonScores: [number, number][]  // [lessonNumber, score]
  }
  const rawMap = new Map<string, RawEntry>()

  for (const lesson of (lessonData ?? [])) {
    const student = (lesson.students as any) as { full_name: string } | null
    const summary = (lesson.lesson_summaries as any) as { score: number | null; talk_percentage: number | null } | null
    const sid = lesson.student_id as string
    if (!student?.full_name) continue

    if (!rawMap.has(sid)) {
      rawMap.set(sid, { name: student.full_name, scores: [], talks: [], lessonScores: [] })
    }
    const entry = rawMap.get(sid)!

    if (summary?.score != null) {
      entry.scores.push(Number(summary.score))
      entry.lessonScores.push([lesson.lesson_number ?? 1, Number(summary.score)])
    }
    if (summary?.talk_percentage != null) {
      entry.talks.push(Number(summary.talk_percentage))
    }
  }

  // ── Generate unique display names (handle "Ryan G." / "Ryan P." collisions) ──
  const firstNameCount: Record<string, number> = {}
  for (const { name } of Array.from(rawMap.values())) {
    const first = name.split(' ')[0]
    firstNameCount[first] = (firstNameCount[first] ?? 0) + 1
  }

  function displayName(fullName: string): string {
    const parts = fullName.split(' ')
    return firstNameCount[parts[0]] > 1 && parts.length > 1
      ? `${parts[0]} ${parts[1][0]}.`
      : parts[0]
  }

  // ── Build summaryData (sorted descending by avg score) ─────────────────────
  const summaryData: SummaryItem[] = Array.from(rawMap.values())
    .map(s => ({
      name: displayName(s.name),
      fullName: s.name,
      avgScore: s.scores.length
        ? Math.round((s.scores.reduce((a, b) => a + b, 0) / s.scores.length) * 10) / 10
        : 0,
      avgTalk: s.talks.length
        ? Math.round(s.talks.reduce((a, b) => a + b, 0) / s.talks.length)
        : 0,
      lessons: s.scores.length,
    }))
    .sort((a, b) => b.avgScore - a.avgScore)

  // ── Build trendData: [{ lesson: 1, Derek: 8.5, Ian: 7.0, ... }, ...] ───────
  const trendMap = new Map<number, Record<string, number>>()
  for (const raw of Array.from(rawMap.values())) {
    const dName = displayName(raw.name)
    for (const [num, score] of raw.lessonScores) {
      if (!trendMap.has(num)) trendMap.set(num, { lesson: num })
      trendMap.get(num)![dName] = score
    }
  }
  const trendData = Array.from(trendMap.values())
    .sort((a, b) => (a.lesson as number) - (b.lesson as number))

  // Student names in the same order as summaryData (descending score)
  const studentNames = summaryData.map(s => s.name)

  // ── Class-wide summary stats ────────────────────────────────────────────────
  const allScores = summaryData.map(s => s.avgScore).filter(s => s > 0)
  const allTalks  = summaryData.map(s => s.avgTalk).filter(t => t > 0)
  const totalLessons  = summaryData.reduce((a, s) => a + s.lessons, 0)
  const classAvgScore = allScores.length
    ? Math.round((allScores.reduce((a, b) => a + b, 0) / allScores.length) * 10) / 10
    : 0
  const classAvgTalk  = allTalks.length
    ? Math.round(allTalks.reduce((a, b) => a + b, 0) / allTalks.length)
    : 0
  const topStudent = summaryData.length
    ? summaryData.reduce((best, s) => s.lessons > best.lessons ? s : best).name
    : '—'

  const classStats = {
    totalLessons,
    avgScore: classAvgScore,
    avgTalk: classAvgTalk,
    topStudent,
  }

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <BarChart2 className="w-5 h-5 text-brand-600" />
          <h1 className="text-2xl font-bold text-ink">Analytics</h1>
        </div>
        <p className="text-sm text-muted">Class-wide performance across all students</p>
      </div>

      {summaryData.length === 0 ? (
        <div className="card p-16 text-center">
          <p className="text-4xl mb-3">📊</p>
          <p className="font-semibold text-ink mb-1">No data yet</p>
          <p className="text-sm text-muted">Publish some lessons to see analytics here.</p>
        </div>
      ) : (
        <ClassAnalyticsCharts
          summaryData={summaryData}
          trendData={trendData}
          studentNames={studentNames}
          classStats={classStats}
        />
      )}
    </div>
  )
}
