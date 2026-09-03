import { createClient, getUser } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { formatDateShort, ordinal, testScore } from '@/lib/utils'
import StudentTour from '@/components/student/StudentTour'
import JapaneseLearningMapCard from '@/components/student/JapaneseLearningMapCard'
import { buildJapaneseLearningMap } from '@/lib/japaneseLearningMap'
import DashboardTabs from '@/components/student/DashboardTabs'
import { DashboardBlock, DASHBOARD_LAYOUT, blockHasContent, type DashboardData } from '@/components/koku/DashboardBlocks'
import type { PillarLesson } from '@/components/koku/LessonPillar'
import { DASH_BLOCK_TAB, DASH_TABS, resolveBrand, type DashTab } from '@/lib/brand'

/** The walkthrough spotlights blocks by name — see StudentTour. */
const TOUR_ANCHOR: Record<string, string | undefined> = {
  stats: 'stats',
  milestone: 'milestones',
  vocabTotals: 'vocab',
  lessons: 'lessons',
  tests: 'tests',
}

/**
 * The student's home — Lesson Studio's dashboard, block for block.
 *
 * Nothing here draws anything: it reads this portal's rows, shapes them into
 * the one `DashboardData` those blocks take, and lets the arrangement in
 * DASHBOARD_LAYOUT decide what appears. A block with nothing to say drops out,
 * which is what lets a brand-new student and one with fifty lessons open the
 * same page.
 *
 * Overview leads with the arc: how much of the last lesson this student did
 * the talking in, against where they started. Their measured speaking — pace,
 * thinking time, share — lives once, on Progress.
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

  const firstName = (student.full_name || user.email || 'student').trim().split(/\s+/)[0]

  const [
    { data: lessons },
    { data: learningLessons },
    { data: tests },
    { data: attempts },
    { data: attachments },
  ] = await Promise.all([
    supabase
      .from('lessons')
      .select(`
        id, lesson_number, lesson_date, title,
        lesson_summaries ( score, talk_percentage, recap, vocab_level_distribution, vocab_total_count, metrics ),
        vocabulary_items ( id, word, reading, definition, jlpt_level ),
        homework_items ( id, completed )
      `)
      .eq('student_id', student.id)
      .eq('status', 'published')
      .order('lesson_number', { ascending: false }),
    supabase
      .from('lessons')
      .select('id, lesson_number, title, lesson_sections ( title, content )')
      .eq('student_id', student.id)
      .eq('status', 'published')
      .order('lesson_number', { ascending: true }),
    supabase
      .from('tests')
      .select('id, title, duration_minutes, lesson_numbers, created_at, test_questions ( id, type, points )')
      .eq('student_id', student.id)
      .eq('status', 'published')
      .order('created_at', { ascending: false }),
    supabase
      .from('test_attempts')
      .select('test_id, started_at, submitted_at')
      .eq('student_id', student.id),
    supabase
      .from('lesson_attachments')
      .select('id, file_name, file_url, lesson_id, lessons!inner ( lesson_number, lesson_date, student_id, status )')
      .eq('lessons.student_id', student.id)
      .eq('lessons.status', 'published'),
  ])

  const rows = (lessons || []) as any[]
  const sum = (l: any) => l.lesson_summaries

  const lessonCount = rows.reduce((max: number, l: any) => Math.max(max, l.lesson_number ?? 0), 0)
  const scores = rows.map((l) => sum(l)?.score).filter((s) => s != null).map(Number)
  const avgScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null
  const latestScore = scores[0] ?? null
  const firstScore = scores[scores.length - 1] ?? null
  const scoreDelta = latestScore != null && firstScore != null ? Number((latestScore - firstScore).toFixed(1)) : null

  const talks = rows.map((l) => sum(l)?.talk_percentage).filter((t) => t != null).map(Number)
  const latestTalk = talks[0] ?? null
  const firstTalk = talks[talks.length - 1] ?? null
  const talkDelta = latestTalk != null && firstTalk != null ? latestTalk - firstTalk : null

  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000
  const recentCount = rows.filter((l) => l.lesson_date && new Date(l.lesson_date).getTime() >= cutoff).length

  // Measured from a recording. Lessons built from a Meet transcript carry no
  // metrics, so they simply do not count toward the average.
  const metricAvg = (key: string) => {
    const vals = rows.map((l) => sum(l)?.metrics?.[key]).filter((v) => typeof v === 'number') as number[]
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
  }

  const vocabDistribution: Record<string, number> = {}
  for (const l of rows) {
    const dist = sum(l)?.vocab_level_distribution
    if (dist && typeof dist === 'object') {
      for (const [level, count] of Object.entries(dist)) {
        vocabDistribution[level] = (vocabDistribution[level] ?? 0) + (count as number)
      }
    }
  }
  const totalVocab = Object.values(vocabDistribution).reduce((a, b) => a + b, 0)

  /**
   * One entry per distinct word, credited to the lesson it FIRST appeared in.
   * A word taught again is the same word met again — worth showing, never
   * counted twice.
   */
  type Word = {
    word: string; reading: string | null; definition: string | null; level: string | null
    isKey: boolean; firstLessonNumber: number | null; firstDate: string | null; lessonCount: number
  }
  const byWord = new Map<string, Word>()
  // Oldest first, so the first sighting really is the first one.
  for (const l of [...rows].reverse()) {
    for (const v of (l.vocabulary_items || []) as any[]) {
      const word = String(v.word ?? '').trim()
      if (!word) continue
      const key = word.toLocaleLowerCase()
      const seen = byWord.get(key)
      if (!seen) {
        byWord.set(key, {
          word,
          reading: v.reading ?? null,
          definition: v.definition ?? null,
          level: v.jlpt_level ?? null,
          isKey: true,
          firstLessonNumber: l.lesson_number ?? null,
          firstDate: l.lesson_date ?? null,
          lessonCount: 1,
        })
      } else {
        seen.lessonCount += 1
      }
    }
  }
  const vocabWords: Word[] = []
  byWord.forEach((v) => vocabWords.push(v))
  vocabWords.sort((a, b) => (b.firstLessonNumber ?? 0) - (a.firstLessonNumber ?? 0) || a.word.localeCompare(b.word))

  // Counted from the words themselves, so the bar and the list below it can
  // never disagree. Falls back to the model's estimate for older lessons.
  const wordLevels: Record<string, number> = {}
  for (const v of vocabWords) if (v.level) wordLevels[v.level] = (wordLevels[v.level] ?? 0) + 1
  const leveled = Object.values(wordLevels).reduce((a, b) => a + b, 0)

  const pillarLessons: PillarLesson[] = rows.map((l) => ({
    id: l.id,
    number: l.lesson_number,
    title: l.title || `Lesson ${l.lesson_number}`,
    desc: sum(l)?.recap ?? undefined,
    meta: `${ordinal(l.lesson_number)} lesson · ${formatDateShort(l.lesson_date)}`,
    score: sum(l)?.score != null ? Number(sum(l).score) : null,
    tag: `Lesson ${l.lesson_number}`,
  }))

  // A test tile leads with its result, so the marks have to be real: the score
  // comes from this student's graded answers, never from a placeholder.
  const testRows = (tests ?? []) as any[]
  const submittedOn = new Map<string, string>()
  for (const a of (attempts ?? []) as any[]) if (a.submitted_at) submittedOn.set(a.test_id, a.submitted_at)
  const { data: testSubs } = testRows.length
    ? await supabase
        .from('test_submissions')
        .select('test_id, question_id, score')
        .in('test_id', testRows.map((t) => t.id))
    : { data: [] as any[] }

  const scoreTrend = rows
    .filter((l) => sum(l)?.score != null)
    .slice(0, 6)
    .reverse()
    .map((l) => ({ lesson: l.lesson_number as number, score: Number(sum(l).score) }))

  const data: DashboardData = {
    lessonCount,
    recentCount,
    scoredCount: scores.length,
    avgScore,
    scoreDelta,
    latestTalk,
    firstTalk,
    talkDelta,
    // No flashcard decks in this portal — the block drops out on its own.
    decks: [],
    cardTotal: 0,
    cardDue: 0,
    pillarLessons,
    progressLessons: rows.map((l) => {
      const s = sum(l)
      const dist = s?.vocab_level_distribution
      const distSum = dist && typeof dist === 'object' ? Object.values(dist).reduce((a: number, b: any) => a + Number(b), 0) : 0
      const m = s?.metrics ?? {}
      return {
        lessonNumber: l.lesson_number,
        score: s?.score ?? null,
        talkPct: s?.talk_percentage ?? null,
        vocabCount: s?.vocab_total_count ?? (distSum > 0 ? distSum : (l.vocabulary_items?.length ?? 0)),
        wpm: m.studentWpm ?? null,
        responseSec: m.avgResponseSec ?? null,
      }
    }),
    vocabDistribution: leveled > 0 ? wordLevels : vocabDistribution,
    totalVocab: vocabWords.length || totalVocab,
    vocabWords: vocabWords.map((v) => ({ ...v, firstDate: v.firstDate ? formatDateShort(v.firstDate) : null })),
    scoreTrend,
    tests: testRows.map((t) => {
      const takenOn = submittedOn.get(t.id) ?? null
      const result = takenOn
        ? testScore(t.test_questions ?? [], ((testSubs ?? []) as any[]).filter((s) => s.test_id === t.id))
        : null
      return {
        id: t.id,
        title: t.title,
        level: t.lesson_numbers?.length ? `Lessons ${t.lesson_numbers.join(', ')}` : null,
        lessonNumber: null,
        date: `${t.duration_minutes} min · ${formatDateShort(t.created_at)}`,
        score: result ? result.percent : null,
        correct: result ? result.score : null,
        total: result ? result.maxScore : null,
        takenOn: takenOn ? formatDateShort(takenOn) : null,
      }
    }),
    avgWpm: metricAvg('studentWpm'),
    avgThinkSec: metricAvg('avgResponseSec'),
    files: ((attachments ?? []) as any[]).map((f) => {
      const l = Array.isArray(f.lessons) ? f.lessons[0] : f.lessons
      return {
        id: f.id,
        fileName: f.file_name,
        url: f.file_url,
        lessonId: f.lesson_id,
        lessonNumber: l?.lesson_number ?? null,
        date: l?.lesson_date ? formatDateShort(l.lesson_date) : null,
      }
    }),
  }

  const brand = resolveBrand(null)
  const L = brand.labels

  const learningMap = buildJapaneseLearningMap((learningLessons || []) as any)

  /** The fixed arrangement, minus anything with nothing to say. */
  const placed = DASHBOARD_LAYOUT.filter(({ id }) => blockHasContent(id, brand, data))
  const tabs = DASH_TABS
    .map((tab) => ({
      id: tab as DashTab,
      label: L[`tab${tab}` as 'tabOverview' | 'tabLessons' | 'tabProgress' | 'tabFiles' | 'tabTests'],
      blocks: placed.filter(({ id }) => DASH_BLOCK_TAB[id] === tab),
    }))
    .filter((t) => t.blocks.length > 0)

  return (
    <>
      <StudentTour show={student.tour_completed_at == null} />

      <div className="k-top">
        <div>
          <p className="k-hello">{L.greeting}</p>
          <h1 className="k-name">{firstName}</h1>
        </div>
      </div>

      <DashboardTabs
        tabs={tabs.map(({ id, label, blocks }) => ({
          id,
          label,
          content: (
            <>
              {blocks.map(({ id: blockId, w }) => (
                <div key={blockId} style={{ ['--w' as any]: w }} data-tour={TOUR_ANCHOR[blockId]}>
                  <DashboardBlock id={blockId} brand={brand} data={data} />
                </div>
              ))}
              {/* Japanese-only, and this portal's own: the grammar a student
                  has met, by category. It belongs with the other trends. */}
              {id === 'Progress' && learningMap.length > 0 && (
                <div style={{ ['--w' as any]: 12 }}>
                  <JapaneseLearningMapCard categories={learningMap} />
                </div>
              )}
            </>
          ),
        }))}
      />
    </>
  )
}
