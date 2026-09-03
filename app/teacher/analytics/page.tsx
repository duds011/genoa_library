import { createClient, getUser } from '@/lib/supabase/server'
import PageHeader from '@/components/PageHeader'
import ClassAnalyticsCharts, { SummaryItem } from '@/components/teacher/ClassAnalyticsCharts'

export default async function AnalyticsPage() {
  const supabase = await createClient()
  const user = await getUser() // memoized — shared with the layout

  const { data: lessonData } = await supabase
    .from('lessons')
    .select(`
      student_id, lesson_number,
      students!inner ( full_name, archived_at ),
      lesson_summaries ( score, talk_percentage, vocab_level_distribution ),
      vocabulary_items ( jlpt_level )
    `)
    .eq('teacher_id', user!.id)
    .eq('status', 'published')
    .not('student_id', 'is', null)
    // Archived students are retired, not deleted — they stay out of the class
    // view the same way they're hidden from the students list, payments and
    // notes grids. !inner is required: without it PostgREST filters the
    // embedded student rather than dropping the lesson.
    .is('students.archived_at', null)
    .order('lesson_number', { ascending: true })

  // ── Collect raw per-student data ──────────────────────────────────────────
  type RawEntry = {
    name: string
    scores: number[]
    talks: number[]
    lessonScores: [number, number][]
    // From vocab_level_distribution (modern lessons — preferred)
    distByLevel: Record<string, number>
    distVocab: number
    // From vocabulary_items (older lessons — fallback only used if no distribution at all)
    itemsByLevel: Record<string, number>
    itemsVocab: number
  }
  const rawMap = new Map<string, RawEntry>()

  for (const lesson of (lessonData ?? [])) {
    const student = (lesson.students as any) as { full_name: string } | null
    const summary = (lesson.lesson_summaries as any) as {
      score: number | null
      talk_percentage: number | null
      vocab_level_distribution?: Record<string, number> | null
    } | null
    const sid = lesson.student_id as string
    if (!student?.full_name) continue

    if (!rawMap.has(sid)) {
      rawMap.set(sid, { name: student.full_name, scores: [], talks: [], lessonScores: [], distByLevel: {}, distVocab: 0, itemsByLevel: {}, itemsVocab: 0 })
    }
    const entry = rawMap.get(sid)!

    if (summary?.score != null) {
      entry.scores.push(Number(summary.score))
      entry.lessonScores.push([lesson.lesson_number ?? 1, Number(summary.score)])
    }
    if (summary?.talk_percentage != null) {
      entry.talks.push(Number(summary.talk_percentage))
    }

    // Preferred: vocab_level_distribution (full GPT counts)
    const dist = summary?.vocab_level_distribution
    if (dist && typeof dist === 'object' && Object.keys(dist).length > 0) {
      for (const [level, count] of Object.entries(dist)) {
        entry.distByLevel[level] = (entry.distByLevel[level] ?? 0) + Number(count)
      }
      entry.distVocab += Object.values(dist).reduce((a, b) => a + b, 0)
    }

    // Fallback candidate: vocabulary_items (used only if this student has zero distribution)
    const items = (lesson as any).vocabulary_items as Array<{ jlpt_level?: string | null }> | null
    if (items) {
      for (const item of items) {
        if (item.jlpt_level) {
          entry.itemsByLevel[item.jlpt_level] = (entry.itemsByLevel[item.jlpt_level] ?? 0) + 1
          entry.itemsVocab += 1
        }
      }
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
    .map(s => {
      // Per-student decision: use distribution if the student has any; otherwise
      // fall back to vocabulary_items so students with older lessons aren't blank.
      const useDistribution = s.distVocab > 0
      return {
        name: displayName(s.name),
        fullName: s.name,
        avgScore: s.scores.length
          ? Math.round((s.scores.reduce((a, b) => a + b, 0) / s.scores.length) * 10) / 10
          : 0,
        avgTalk: s.talks.length
          ? Math.round(s.talks.reduce((a, b) => a + b, 0) / s.talks.length)
          : 0,
        lessons: s.scores.length,
        totalVocab: useDistribution ? s.distVocab : s.itemsVocab,
        vocabByLevel: useDistribution ? s.distByLevel : s.itemsByLevel,
      }
    })
    .sort((a, b) => b.avgScore - a.avgScore)

  // ── Build progressionData ──────────────────────────────────────────────────
  // One series per student rather than 21 lines on a shared axis. The old chart
  // was unreadable spaghetti — a student losing 1.5 points was invisible in it.
  // Sorted by biggest drop first so whoever needs attention is top-left.
  // Each student's lessons are re-indexed from 1: several were taught for months
  // before the portal existed and carry lesson numbers in the 20s-60s, so the
  // real number is kept per point for the tooltip.
  const progressionData = Array.from(rawMap.values())
    .map(raw => {
      const ordered = [...raw.lessonScores].sort((a, b) => a[0] - b[0])
      const scores = ordered.map(([, s]) => s)
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length
      return {
        name: displayName(raw.name),
        fullName: raw.name,
        points: ordered.map(([lesson, score], i) => ({ idx: i + 1, lesson, score })),
        avg: Math.round(avg * 10) / 10,
        // First lesson to last. One data point means no trend to report.
        delta: scores.length > 1 ? Math.round((scores[scores.length - 1] - scores[0]) * 10) / 10 : 0,
        lessons: scores.length,
      }
    })
    .filter(s => s.lessons > 0)
    .sort((a, b) => a.delta - b.delta || b.lessons - a.lessons)

  // Zoom the y-axis to the scores that actually exist, and share it across every
  // card so the sparklines stay comparable. Real scores sit between roughly 5.5
  // and 9.5, so a fixed 0-10 axis flattens each line into a straight streak.
  const trendScores = Array.from(rawMap.values()).flatMap(r => r.lessonScores.map(([, s]) => s))
  const half = (n: number) => Math.round(n * 2) / 2
  const scoreDomain: [number, number] = trendScores.length
    ? [
        Math.max(0, half(Math.floor((Math.min(...trendScores) - 0.2) * 2) / 2)),
        Math.min(10, half(Math.ceil((Math.max(...trendScores) + 0.2) * 2) / 2)),
      ]
    : [0, 10]

  // Student names in the same order as summaryData (descending score)

  // ── Class-wide summary stats ────────────────────────────────────────────────
  const allScores    = summaryData.map(s => s.avgScore).filter(s => s > 0)
  const allTalks     = summaryData.map(s => s.avgTalk).filter(t => t > 0)
  const totalLessons = summaryData.reduce((a, s) => a + s.lessons, 0)
  const totalVocab   = summaryData.reduce((a, s) => a + s.totalVocab, 0)

  const classAvgScore = allScores.length
    ? Math.round((allScores.reduce((a, b) => a + b, 0) / allScores.length) * 10) / 10
    : 0
  const classAvgTalk = allTalks.length
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
    totalVocab,
  }

  return (
    <div className="k-page" style={{ display: 'grid', gap: 18 }}>
      <PageHeader
        eyebrow="Teacher"
        title="Analytics"
        meta="How the whole class is doing, student by student."
        figures={[
          { label: 'Students', value: summaryData.length },
          { label: 'Lessons', value: classStats.totalLessons },
          { label: 'Class avg', value: <>{classStats.avgScore || '—'}<i>/10</i></> },
          { label: 'Talk share', value: <>{classStats.avgTalk || '—'}<i>%</i></> },
        ]}
      />

      {summaryData.length === 0 ? (
        <div className="empty">
          <strong style={{ color: 'var(--ink)' }}>No data yet</strong>
          <br />
          Publish some lessons to see analytics here.
        </div>
      ) : (
        <ClassAnalyticsCharts
          summaryData={summaryData}
          progressionData={progressionData}
          classStats={classStats}
          scoreDomain={scoreDomain}
        />
      )}
    </div>
  )
}
