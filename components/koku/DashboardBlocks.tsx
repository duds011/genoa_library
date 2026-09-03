import Link from 'next/link'
import ProgressCharts from '@/components/student/ProgressSwipe'
import VocabLevelBreakdown from './VocabLevelBreakdown'
import VocabByLevel from './VocabByLevel'
import { MilestoneTrack, ScoreTrendChart } from './BrandCharts'
import CountUp from './CountUp'
import LessonPillar, { PillarLesson } from './LessonPillar'
import { DASH_SPEAK_TILES, DASH_STAT_TILES, levelProgress, type Brand, type BlockId, type DashSpeakId, type DashStatId } from '@/lib/brand'

/**
 * Every block on the student dashboard, in one place.
 *
 * The branding studio used to draw its own imitation of this page — a second
 * set of components that looked roughly like the real ones. They drifted:
 * change a chart here and the teacher's preview kept showing the old one, so
 * what a teacher designed was never quite what their student opened. Both
 * sides now render this, so they cannot disagree.
 *
 * Nothing in here reads from the database. The real page passes a student's
 * numbers, the studio passes made-up ones, and the markup is identical.
 */

export type DashboardData = {
  lessonCount: number
  recentCount: number
  scoredCount: number
  avgScore: number | null
  scoreDelta: number | null
  latestTalk: number | null
  /** Practice decks, sized and filtered — empty ones never reach here. */
  decks: { id: string; label: string; sub: string; tone: string; total: number; due: number; known: number }[]
  cardTotal: number
  cardDue: number
  /** Talk share in the earliest scored lesson — the gauge's starting mark. */
  firstTalk: number | null
  talkDelta: number | null
  pillarLessons: PillarLesson[]
  progressLessons: {
    lessonNumber: number
    score: number | null
    talkPct: number | null
    vocabCount: number
    wpm?: number | null
    responseSec?: number | null
  }[]
  vocabDistribution: Record<string, number>
  totalVocab: number
  /** Distinct words, newest first, each attributed to where it first appeared. */
  vocabWords: {
    word: string
    reading: string | null
    definition: string | null
    level: string | null
    isKey?: boolean
    firstLessonNumber: number | null
    firstDate: string | null
    lessonCount: number
  }[]
  scoreTrend: { lesson: number; score: number }[]
  tests: {
    id: string; title: string; level: string | null
    lessonNumber: number | null; date: string | null
    /** Null until the student has finished it — that is what splits the two states. */
    score: number | null; correct: number | null; total: number | null; takenOn: string | null
  }[]
  avgWpm: number | null
  avgThinkSec: number | null
  /** `url` is where the file actually lives — this portal keeps attachments in
   *  a public bucket rather than behind a signed-download route. */
  files: { id: string; fileName: string; url: string; lessonId: string; lessonNumber: number | null; date: string | null }[]
}

/** The studio's canvas is a picture of a page, not the page — nothing in it
 *  should navigate, and its charts should not animate on every re-render. The
 *  onRemove* callbacks are studio-only too: per-tile ✕s for the stat cards and
 *  the speaking tiles, never rendered on a student's page. */
type Mode = {
  preview?: boolean
  onRemoveStat?: (id: DashStatId) => void
  onRemoveSpeak?: (id: DashSpeakId) => void
}

/** The studio's small per-tile remove button — see .k-zap in koku2.css. */
function TileX({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="k-zap-x k-zap-x-sm" aria-label={`Remove ${label}`} title={`Remove ${label}`} onClick={onClick}>✕</button>
  )
}

const Icon = ({ d }: { d: string }) => (
  <svg className="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
)

/** A link on the real page, inert text in the preview. */
function Go({ href, className, children, preview }: { href: string; className?: string; children: React.ReactNode; preview?: boolean }) {
  if (preview) return <span className={className}>{children}</span>
  return <Link href={href} className={className}>{children}</Link>
}

/**
 * The fixed arrangement. The teacher used to drag these around and pull their
 * edges; a layout they could break in a hundred ways bought less than it cost,
 * so the shape is ours and the styling is theirs. `w` is the share of a
 * 12-column row — see .k-flow.
 */
export const DASHBOARD_LAYOUT: { id: BlockId; w: number }[] = [
  // Overview reads top to bottom, each band the full width: the three figures,
  // then where they are heading, then what they have collected, then how each
  // lesson went. Side by side, the milestone and the scores each got half a
  // page and neither had room to say anything.
  { id: 'stats', w: 12 },
  { id: 'milestone', w: 12 },
  { id: 'vocabTotals', w: 12 },
  { id: 'scores', w: 12 },
  { id: 'lessons', w: 12 },
  // Progress opens with how they sound, then the trends, then the words.
  { id: 'speaking', w: 12 },
  { id: 'progress', w: 12 },
  { id: 'vocab', w: 12 },
  // Practice sits with the words it is made of.
  { id: 'flashcards', w: 12 },
  { id: 'files', w: 12 },
  { id: 'tests', w: 12 },
]

/** Whether a block has anything to say for this student. */
export function blockHasContent(id: BlockId, brand: Brand, d: DashboardData): boolean {
  switch (id) {
    case 'stats': return brand.showStats && (brand.hiddenStats?.length ?? 0) < DASH_STAT_TILES.length
    case 'lessons': return brand.showLessons && d.pillarLessons.length > 0
    case 'progress': return brand.showProgress && d.progressLessons.length >= 2
    case 'vocab': return brand.showVocab && d.vocabWords.length > 0
    case 'vocabTotals': return brand.showVocabTotals && d.totalVocab > 0
    case 'milestone': return brand.showMilestone
    case 'scores': return brand.showScores && d.scoreTrend.length > 0
    case 'tests': return brand.showTests && d.tests.length > 0
    case 'speaking': {
      // A tile needs both its data and its switch — the block stays only while
      // at least one tile has both.
      const hid = brand.hiddenSpeaking ?? []
      return brand.showSpeaking && (
        (d.avgWpm != null && !hid.includes('pace'))
        || (d.avgThinkSec != null && !hid.includes('think'))
        || (d.latestTalk != null && !hid.includes('share'))
      )
    }
    case 'flashcards': return brand.showFlashcards && d.decks.length > 0
    case 'files': return brand.showFiles && d.files.length > 0
    default: return false
  }
}

export function DashboardBlock({ id, brand, data: d, preview, onRemoveStat, onRemoveSpeak }: { id: BlockId; brand: Brand; data: DashboardData } & Mode) {
  const L = brand.labels
  const milestone = levelProgress(brand.levels, d.lessonCount)

  switch (id) {
    case 'stats': {
      const hid = brand.hiddenStats ?? []

      /**
       * The dashboard's job is to answer "am I getting better?" before you
       * scroll, and three stat tiles never did. The one number that moved is
       * the share of the lesson this student did the talking in, so it becomes
       * the page: an arc for where they are now, a mark for where they began.
       *
       * Falls back to the tiles when there is nothing to compare yet — a first
       * lesson has no journey, and an arc with the mark under the needle would
       * be a worse way to say so.
       */
      const canArc = !hid.includes('speaking') && d.latestTalk != null
        && d.firstTalk != null && d.talkDelta != null && d.scoredCount > 1
      if (canArc) {
        const now = d.latestTalk as number
        const then = d.firstTalk as number
        const delta = d.talkDelta as number
        // A half circle: 0% at the left, 100% at the right.
        const R = 132, CX = 165, CY = 170, SW = 22
        const pt = (v: number) => {
          const a = Math.PI * (1 - v / 100)
          return [CX + Math.cos(a) * R, CY - Math.sin(a) * R] as const
        }
        const arc = (to: number) => {
          const A = pt(0), B = pt(to)
          // large-arc-flag stays 0: the sweep is never more than a half turn.
          return `M${A[0].toFixed(1)} ${A[1].toFixed(1)} A${R} ${R} 0 0 1 ${B[0].toFixed(1)} ${B[1].toFixed(1)}`
        }
        const mark = pt(then)
        const ma = Math.PI * (1 - then / 100)
        const headline = delta > 0
          ? (now >= 50
            ? <>You went from listening to <em>leading the conversation</em>.</>
            : <>You are speaking <em>{delta} points more</em> than when you started.</>)
          : <>You spoke <em>{now}%</em> of your last lesson.</>

        const strip = DASH_STAT_TILES
          .filter(({ id: sid }) => sid !== 'speaking' && !hid.includes(sid))
          .map(({ id: sid, label }) => (
            <div className={`k-climb-stat ${onRemoveStat ? 'k-zap' : ''}`} key={sid}>
              {onRemoveStat && <TileX label={label} onClick={() => onRemoveStat(sid)} />}
              <b>
                {sid === 'lessons'
                  ? <CountUp value={d.lessonCount} />
                  : d.avgScore != null ? <CountUp value={d.avgScore} decimals={1} /> : '—'}
              </b>
              <s>{sid === 'lessons' ? L.statLessons : L.statScore}</s>
            </div>
          ))

        return (
          <div className={`k-climb ${onRemoveStat ? 'k-zap' : ''}`}>
            {onRemoveStat && <TileX label="Speaking share" onClick={() => onRemoveStat('speaking')} />}
            <div className="k-climb-arc">
              <svg viewBox="0 0 330 196" role="img"
                   aria-label={`You spoke ${now} percent of your last lesson, up from ${then} percent`}>
                <path d={arc(100)} fill="none" stroke="var(--surface-2)" strokeWidth={SW} strokeLinecap="round" />
                <path className="k-climb-fill" d={arc(now)} fill="none" stroke="var(--forest)"
                      strokeWidth={SW} strokeLinecap="round" pathLength={100} />
                <line
                  x1={(mark[0] - Math.cos(ma) * 14).toFixed(1)} y1={(mark[1] + Math.sin(ma) * 14).toFixed(1)}
                  x2={(mark[0] + Math.cos(ma) * 14).toFixed(1)} y2={(mark[1] - Math.sin(ma) * 14).toFixed(1)}
                  stroke="var(--ink)" strokeWidth="2.5" strokeLinecap="round" opacity=".5"
                />
              </svg>
              <div className="k-climb-mid">
                <b><CountUp value={now} /><span>%</span></b>
                <s>You spoke</s>
              </div>
            </div>
            <div className="k-climb-copy">
              <div className="k-climb-eyebrow">Across {d.lessonCount} lesson{d.lessonCount === 1 ? '' : 's'}</div>
              <h2 className="k-climb-line">{headline}</h2>
              <p className="k-climb-sub">The mark on the arc is where you started — <b>{then}%</b>.</p>
              {delta > 0 && <span className="k-climb-delta">▲ {delta} points since lesson 1</span>}
              {strip.length > 0 && <div className="k-climb-strip">{strip}</div>}
            </div>
          </div>
        )
      }

      // One entry per card, so the teacher keeps the average and drops the
      // talk-share (or any mix) instead of all three or none.
      const CARD: Record<DashStatId, React.ReactNode> = {
        lessons: (
          <>
            <div className="k-stat-head"><Icon d="M4 5h16v14H4zM4 9h16M9 9v10" /><span>{L.statLessons}</span></div>
            <div className="k-stat-val">
              <b><CountUp value={d.lessonCount} /></b>
              {d.recentCount > 0 && <span className="k-chip">+{d.recentCount}</span>}
            </div>
            <p className="k-stat-sub">{d.recentCount > 0 ? `${d.recentCount} in the last 30 days` : 'Total lessons completed'}</p>
          </>
        ),
        score: (
          <>
            <div className="k-stat-head"><Icon d="M12 3v18M5 10l7-7 7 7" /><span>{L.statScore}</span></div>
            <div className="k-stat-val">
              <b>{d.avgScore != null ? <CountUp value={d.avgScore} decimals={1} /> : '—'}</b>
              {d.scoreDelta != null && d.scoreDelta !== 0 && (
                <span className="k-chip">{d.scoreDelta > 0 ? '▲' : '▼'} {Math.abs(d.scoreDelta).toFixed(1)}</span>
              )}
            </div>
            <p className="k-stat-sub">out of 10 across {d.scoredCount} scored lesson{d.scoredCount === 1 ? '' : 's'}</p>
          </>
        ),
        speaking: (
          <>
            <div className="k-stat-head"><Icon d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zM5 11a7 7 0 0 0 14 0M12 18v3" /><span>{L.statSpeaking}</span></div>
            <div className="k-stat-val">
              <b>{d.latestTalk != null ? <CountUp value={d.latestTalk} /> : '—'}<span style={{ fontSize: 19 }}>%</span></b>
              {d.talkDelta != null && d.talkDelta !== 0 && (
                <span className="k-chip">{d.talkDelta > 0 ? '▲' : '▼'} {Math.abs(d.talkDelta)}%</span>
              )}
            </div>
            <p className="k-stat-sub">of the last lesson was you talking</p>
          </>
        ),
      }
      const TONE: Record<DashStatId, string> = { lessons: 'yellow', score: 'blue', speaking: 'purple' }
      const cards = DASH_STAT_TILES.filter(({ id: sid }) => !hid.includes(sid))
      if (cards.length === 0) return null
      return (
        <div className="k-stats">
          {cards.map(({ id: sid, label }) => (
            <div className={`k-stat ${TONE[sid]} ${onRemoveStat ? 'k-zap' : ''}`} key={sid}>
              {onRemoveStat && <TileX label={label} onClick={() => onRemoveStat(sid)} />}
              {CARD[sid]}
            </div>
          ))}
        </div>
      )
    }

    case 'lessons':
      return (
        <>
          <div className="k-sec-head"><h2>{L.lessonsTitle}</h2><span className="k-link">{d.pillarLessons.length} in all</span></div>
          <LessonPillar lessons={d.pillarLessons} preview={preview} />
        </>
      )

    case 'progress':
      return (
        <>
          <div className="k-sec-head"><h2>{L.progressTitle}</h2></div>
          <div className="k-card"><ProgressCharts lessons={d.progressLessons} /></div>
        </>
      )

    case 'vocabTotals':
      // The overview's answer to "how much have I picked up" — the totals bar
      // only. The words themselves are a Progress-tab read, not a glance.
      return (
        <>
          <div className="k-sec-head"><h2>{L.vocabTotalsTitle}</h2><span className="k-link">{d.totalVocab} words</span></div>
          <div className="k-card">
            <VocabLevelBreakdown distribution={d.vocabDistribution} totalCount={d.totalVocab} plain />
          </div>
        </>
      )

    case 'vocab':
      // The bar first, the words on request. Listing all of them made this a
      // wall of text people scrolled past; "how much, at what level" is the
      // question a glance asks, and a level opens to answer "which words".
      return (
        <>
          <div className="k-sec-head"><h2>{L.vocabTitle}</h2><span className="k-link">{d.vocabWords.length} words</span></div>
          <div className="k-card">
            <VocabByLevel words={d.vocabWords} />
          </div>
        </>
      )

    case 'milestone':
      return (
        <div className="k-card">
          <div className="k-card-head"><h3>{L.milestoneTitle}</h3><span className="k-link">{milestone.label}</span></div>
          <MilestoneTrack levels={brand.levels} lessonCount={d.lessonCount} color={brand.accent} />
          <p className="k-course-meta" style={{ marginTop: 11 }}>
            {milestone.remaining > 0
              ? `${d.lessonCount} of ${milestone.target} lessons towards ${milestone.label}`
              : `Every level cleared — ${d.lessonCount} lessons in.`}
          </p>
        </div>
      )

    case 'scores':
      return (
        <div className="k-card k-chart-card">
          <div className="k-card-head"><h3>{L.scoresTitle}</h3><span className="k-link">Last {d.scoreTrend.length}</span></div>
          <div className="k-chart-fill"><ScoreTrendChart points={d.scoreTrend} color={brand.accent} height="100%" /></div>
        </div>
      )

    case 'tests':
      return (
        <div className="k-card">
          <div className="k-card-head"><h3>{L.testsTitle}</h3><span className="k-link">{d.tests.length}</span></div>
          {/* Deliberately not the homework row used elsewhere: a test is an
              event, not another line in a list, and it has two states worth
              telling apart at a glance — waiting to be taken, or scored. */}
          <div className="k-tests">
            {d.tests.map((t) => {
              const done = t.score !== null
              // A score is feedback, so it should not all look like praise —
              // 45% rendered in the same green as 82% tells the student they
              // did well when they did not.
              const tone = !done ? '' : t.score! >= 70 ? ' is-good' : t.score! >= 50 ? ' is-mid' : ' is-low'
              return (
                <Go
                  key={t.id}
                  href={`/student/tests/${t.id}`}
                  className={`k-test${done ? ' is-done' : ''}${tone}`}
                  preview={preview}
                >
                  <span className="k-test-mark" aria-hidden>{done ? `${t.score}%` : '✎'}</span>
                  <span className="k-test-body">
                    <span className="k-test-title">{t.title}</span>
                    <span className="k-test-meta">
                      {t.level ? `${t.level} · ` : ''}
                      {t.lessonNumber ? `Lesson ${t.lessonNumber} · ` : ''}
                      {done ? `Scored ${t.correct}/${t.total} on ${t.takenOn}` : t.date}
                    </span>
                  </span>
                  <span className="k-test-cta">{done ? 'Review' : 'Start'}</span>
                </Go>
              )
            })}
          </div>
        </div>
      )

    case 'speaking': {
      // Same colourful rectangles as the overview stats, so the page reads as
      // one system rather than a card of small print at the bottom. Tiles show
      // when they have data AND the teacher keeps them — any mix stands.
      const hid = brand.hiddenSpeaking ?? []
      const tiles: { id: DashSpeakId; label: string; node: React.ReactNode }[] = []
      if (d.avgWpm != null && !hid.includes('pace')) tiles.push({
        id: 'pace', label: 'Pace',
        node: (
          <>
            <div className="k-stat-head"><Icon d="M13 3 4 14h6l-1 7 9-11h-6z" /><span>Pace</span></div>
            <div className="k-stat-val">
              <b><CountUp value={Math.round(d.avgWpm)} /><span style={{ fontSize: 17 }}> wpm</span></b>
            </div>
            <p className="k-stat-sub">words per minute when you speak</p>
          </>
        ),
      })
      if (d.avgThinkSec != null && !hid.includes('think')) tiles.push({
        id: 'think', label: 'Thinking time',
        node: (
          <>
            <div className="k-stat-head"><Icon d="M12 8v4l3 3M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z" /><span>Thinking time</span></div>
            <div className="k-stat-val">
              <b><CountUp value={d.avgThinkSec} decimals={1} /><span style={{ fontSize: 17 }}> s</span></b>
            </div>
            <p className="k-stat-sub">average pause before you answer</p>
          </>
        ),
      })
      if (d.latestTalk != null && !hid.includes('share')) tiles.push({
        id: 'share', label: 'Your share',
        node: (
          <>
            <div className="k-stat-head"><Icon d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zM5 11a7 7 0 0 0 14 0M12 18v3" /><span>Your share</span></div>
            <div className="k-stat-val">
              <b><CountUp value={d.latestTalk} /><span style={{ fontSize: 17 }}>%</span></b>
            </div>
            <p className="k-stat-sub">of the last lesson was you talking</p>
          </>
        ),
      })
      if (tiles.length === 0) return null
      const SPEAK_TONE: Record<DashSpeakId, string> = { pace: 'blue', think: 'purple', share: 'yellow' }
      return (
        <>
          <div className="k-sec-head"><h2>{L.speakingTitle}</h2></div>
          <div className="k-speak-grid">
            {tiles.map(({ id: sid, label, node }) => (
              <div className={`k-stat ${SPEAK_TONE[sid]} ${onRemoveSpeak ? 'k-zap' : ''}`} key={sid}>
                {onRemoveSpeak && <TileX label={label} onClick={() => onRemoveSpeak(sid)} />}
                {node}
              </div>
            ))}
          </div>
        </>
      )
    }

    case 'flashcards': {
      // Decks are already filtered to the ones with cards, so a student who has
      // only ever met nouns sees one deck rather than five empty boxes.
      const label = d.cardDue === d.cardTotal ? 'all new' : `${d.cardDue} ready`
      return (
        <>
          <div className="k-sec-head"><h2>Practise your words</h2><span className="k-link">{label}</span></div>
          <div className="k-card k-decks-card">
            <p className="k-decks-sub">
              Every word from your lessons, split by what kind of word it is.
              Cards you get right come back later; ones you miss come back today.
            </p>
            <div className="k-decks">
              {d.decks.map((deck) => (
                <Go key={deck.id} href={`/student/practice?deck=${deck.id}`} className={`k-deck ${deck.tone}`} preview={preview}>
                  <span className="k-deck-n">{deck.total}</span>
                  <span className="k-deck-k">{deck.label}</span>
                  <span className="k-deck-s">{deck.due > 0 ? `${deck.due} to review` : 'all caught up'}</span>
                </Go>
              ))}
            </div>
            <Go href="/student/practice" className="k-deck-all" preview={preview}>
              Practise everything<span>{d.cardTotal} cards →</span>
            </Go>
          </div>
        </>
      )
    }

    case 'files':
      // Everything the teacher has shared, newest first. Each file also lives
      // on its lesson's recap — this is the one place to find them all.
      return (
        <>
          <div className="k-sec-head"><h2>{L.filesTitle}</h2><span className="k-link">{d.files.length}</span></div>
          <div className="k-card">
            <div className="k-hw">
              {d.files.map((f) => (
                <div key={f.id} className="k-hw-row" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span className="k-file-ic" aria-hidden>
                    <Icon d="M14 3v5h5M6 3h8l5 5v13H6z" />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="k-hw-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.fileName}</div>
                    <div className="k-hw-due">
                      {f.lessonNumber != null ? `Lesson ${f.lessonNumber}` : 'Lesson'}{f.date ? ` · ${f.date}` : ''}
                    </div>
                  </div>
                  {preview ? (
                    <span className="k-btn-pill">Download</span>
                  ) : (
                    <a className="k-btn-pill" href={f.url} target="_blank" rel="noopener noreferrer">Open</a>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )

    default:
      return null
  }
}
