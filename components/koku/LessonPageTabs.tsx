'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { FormattedContent } from './RecapView'
import RecapSections from './RecapSections'
import LessonCorrections from './LessonCorrections'
import { hesitationExamples } from '@/lib/languages'
import CountUp from './CountUp'
import {
  DEFAULT_BRAND, LESSON_BLOCK_LABELS, LESSON_BLOCK_TOGGLE, LESSON_LAYOUT, LESSON_LOCKED,
  LESSON_MOVEMENTS, RECAP_METRICS, TAB_MOVEMENT,
  type Brand, type LessonBlockId, type LessonTab, type MovementId, type RecapMetricId,
} from '@/lib/brand'

type Recap = any
type Lesson = { id: string; lessonNumber: number; date: string; title: string; recap: Recap }

/** A measured number, or an em dash when the recording didn't yield one. */
function Metric({ v, decimals = 0, suffix = '' }: { v: unknown; decimals?: number; suffix?: string }) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return <>—</>
  return <CountUp value={v} decimals={decimals} suffix={suffix} />
}

export default function LessonPageTabs({
  lesson, studentFirst, teacherFirst = 'Your teacher', brand = DEFAULT_BRAND, files, preview,
  language, exercises, back, tab: controlledTab, onTabChange, onRemoveSection, onRemoveMetric,
}: {
  lesson: Lesson; studentFirst: string; teacherFirst?: string; brand?: Brand
  /** The language this student is learning — picks the hesitation examples. */
  language?: string | null
  /** File exchange, filling the Files tab. Omitted = no tab. */
  files?: React.ReactNode
  /** The interactive practice block — see the 'exercises' case. */
  exercises?: React.ReactNode
  /**
   * Branding-studio canvas. The memo and the file drawer are the two sections
   * whose contents come from uploads rather than the recap, so a preview has
   * nothing to pass them — and a teacher deciding whether to keep those
   * sections has to be able to see them. Under `preview` they stand in for
   * themselves, in the page's own markup.
   */
  preview?: boolean
  /**
   * Where "back" goes, and what to call it. Rendered inside the sticky chrome
   * rather than at the top of the page: a back link that scrolls away means
   * scrolling all the way up again to leave, and on a phone the top of the
   * screen is the hardest place to reach anyway.
   */
  back?: { href: string; label: string }
  /** Drive the tab from outside — the studio's Sections menu does, so picking a
   *  group there opens the tab it edits. Left off, the page owns its own. */
  tab?: LessonTab
  onTabChange?: (t: LessonTab) => void
  /**
   * Studio only: lets the teacher remove a section from the page itself.
   * When set, hovering any section shows its name and a ✕ — see .k-zap. The
   * student's page never passes this, so students never see the buttons.
   */
  onRemoveSection?: (id: LessonBlockId) => void
  /** Studio only, one level finer: takes a single measured-speaking tile off. */
  onRemoveMetric?: (id: RecapMetricId) => void
}) {
  const r = lesson.recap
  const m = r.metrics as any
  const [ownTab, setOwnTab] = useState<LessonTab>('Progress')
  const tab = controlledTab ?? ownTab
  const setTab = onTabChange ?? setOwnTab

  const studentTalk = typeof r.talk_percentage === 'number' ? r.talk_percentage : 40
  const teacherTalk = 100 - studentTalk

  const allSections: any[] = r.sections || []
  // Recaps built before corrections were structured carry them as a free-text
  // section instead. Both shapes render, so published lessons keep working.
  const legacyCorrections = allSections.find((s) => /main corrections|refinement|takeaway/i.test(s.title))
  const lessonSections = allSections.filter((s) => !/main corrections|refinement|takeaway/i.test(s.title))
  const corrections: any[] = Array.isArray(r.corrections) ? r.corrections : []
  const didWell: any[] = Array.isArray(r.did_well) ? r.did_well : []
  // Checked by type, not by .length. A string has a length too, so a recap
  // whose homework came back as prose rather than a list sailed past the old
  // `homework?.length > 0` guard and then threw on .map, white-screening the
  // whole page. The model writes this JSON; it does not always write it twice
  // the same way.
  const homework: any[] = Array.isArray(r.homework) ? r.homework : []

  /** Height a chart gets inside a block the teacher sized (card chrome removed). */

  /**
   * Every arrangeable section of this page, keyed the same way as the studio
   * preview. A section that has nothing to show returns null and drops out of
   * the flow entirely.
   */
  const section = (id: LessonBlockId): React.ReactNode => {
    switch (id) {
      case 'balance':
        return (
          <div className="stat-card" style={{ ['--accent' as any]: 'var(--brand)' }}>
            <div className="stat-card-head"><span className="stat-icon">🗣️</span><span className="stat-card-label">Speaking balance</span></div>
            <div className="stat-card-value"><CountUp value={studentTalk} /><span className="stat-unit">%</span> <span className="stat-sep">/</span> <CountUp value={teacherTalk} /><span className="stat-unit">%</span></div>
            <div className="balance-bars" style={{ marginTop: 'auto' }}>
              <div className="balance-row"><span>{studentFirst}</span><div className="balance-track"><div className="balance-fill student" style={{ width: `${studentTalk}%` }} /></div><span>{studentTalk}%</span></div>
              <div className="balance-row"><span>{teacherFirst}</span><div className="balance-track"><div className="balance-fill" style={{ width: `${teacherTalk}%` }} /></div><span>{teacherTalk}%</span></div>
            </div>
          </div>
        )
      case 'score':
        if (r.score == null) return null
        return (
          <div className="stat-card" style={{ ['--accent' as any]: 'var(--green)' }}>
            <div className="stat-card-head"><span className="stat-icon">⭐</span><span className="stat-card-label">Score</span></div>
            <div className="stat-card-value" style={{ color: 'var(--green)' }}>
              <CountUp value={Number(r.score)} decimals={Number.isInteger(Number(r.score)) ? 0 : 1} />
              <span className="stat-unit">/10</span>
            </div>
            {r.confidence_label && <span className="stat-chip" style={{ marginTop: 'auto' }}>{r.confidence_label}</span>}
          </div>
        )
      case 'grammar':
        if (!r.grammar_density) return null
        return (
          <div className="stat-card" style={{ ['--accent' as any]: '#a36210' }}>
            <div className="stat-card-head"><span className="stat-icon">📚</span><span className="stat-card-label">Grammar density</span></div>
            <div className="stat-card-value" style={{ fontSize: '1.6rem' }}>{r.grammar_density}</div>
            <p className="stat-card-note" style={{ marginTop: 'auto' }}>{r.vocab_total_count ? `${r.vocab_total_count} vocabulary items practiced` : ''}</p>
          </div>
        )
      case 'metrics': {
        if (!m) return null
        // One entry per tile, keyed like RECAP_METRICS, so a teacher removes
        // the tiles they don't teach by rather than the whole card at once.
        const TILE: Record<RecapMetricId, { v: unknown; decimals?: number; suffix?: string; mk: string; mn: string }> = {
          wpm: { v: m.studentWpm, mk: 'words / min', mn: 'speaking pace' },
          think: { v: m.avgResponseSec, decimals: 1, suffix: 's', mk: 'thinking time', mn: 'before you reply' },
          longest: { v: m.longestTurnSec, suffix: 's', mk: 'longest answer', mn: 'best stretch' },
          turn: { v: m.avgTurnWords, mk: 'words / answer', mn: 'avg turn length' },
          fillers: { v: m.fillerCount, mk: 'hesitation words', mn: hesitationExamples(language) },
          pauses: { v: m.longPauseCount, mk: 'long pauses', mn: 'silences ≥ 1.5s' },
        }
        const hidden = brand.hiddenMetrics ?? []
        const tiles = RECAP_METRICS.filter(({ id }) => !hidden.includes(id))
        // Every tile removed removes the card — an empty measurement panel
        // would only ask the student what used to be there.
        if (tiles.length === 0) return null
        // Bare grid: the "how you spoke" panel owns the heading and the card
        // around it, so the six tiles sit with the talk bar instead of in a
        // third box of their own.
        return (
          <div className="metric-grid">
              {tiles.map(({ id, label }) => {
                const t = TILE[id]
                return (
                  <div className={`metric ${onRemoveMetric ? 'k-zap' : ''}`} key={id}>
                    {onRemoveMetric && (
                      <button
                        type="button"
                        className="k-zap-x k-zap-x-sm"
                        aria-label={`Remove ${label}`}
                        title={`Remove ${label}`}
                        onClick={() => onRemoveMetric(id)}
                      >✕</button>
                    )}
                    <div className="mv"><Metric v={t.v} decimals={t.decimals} suffix={t.suffix} /></div>
                    <div className="mk">{t.mk}</div>
                    <div className="mn">{t.mn}</div>
                  </div>
                )
              })}
          </div>
        )
      }
      case 'corrections':
        if (corrections.length > 0 || didWell.length > 0) {
          return (
            <div className="corrections-card">
              <div className="stat-card-head" style={{ marginBottom: '.75rem' }}><span className="stat-icon">✍️</span><span className="stat-card-label">Corrections</span></div>
              <LessonCorrections corrections={corrections} didWell={didWell} who={studentFirst} />
            </div>
          )
        }
        if (!legacyCorrections) return null
        return (
          <div className="corrections-card">
            <div className="stat-card-head" style={{ marginBottom: '.75rem' }}><span className="stat-icon">✍️</span><span className="stat-card-label">{legacyCorrections.title.replace(/^\d+\.\s*/, '')}</span></div>
            <FormattedContent content={legacyCorrections.content} />
          </div>
        )
      case 'sections':
        if (lessonSections.length === 0) return null
        // Was a stack of complete write-ups — the longest thing in the recap
        // and the part students stopped reading. Now a contents list that
        // opens one part at a time; see RecapSections.
        return <RecapSections sections={lessonSections} />
      case 'memo':
        // The memo lives in the page header now, beside the date — and the
        // script it was read from is a recording aid, not recap content. It
        // leaked to students here once; nothing on this page renders it again.
        return null
      case 'files':
        if (files) return files
        if (!preview) return null
        return (
          <div className="lesson-stack">
            <div className="lesson-block">
              <h3 style={{ margin: '0 0 12px' }}>📎 Files from your teacher</h3>
              <p className="analytics-note" style={{ margin: 0 }}>
                Presentations and PDFs you attach to this lesson, ready to download.
              </p>
            </div>
            <div className="lesson-block">
              <h3 style={{ margin: '0 0 12px' }}>🎙️ Practice audio</h3>
              <p className="analytics-note" style={{ margin: 0 }}>
                Your student records themselves here, and you listen back.
              </p>
            </div>
          </div>
        )
      case 'homework':
        return (
          <div className="lesson-block">
            <h3>Homework</h3>
            {homework.length === 0 ? <p className="analytics-note">No homework for this lesson.</p> : (
              <ul>{homework.map((hw: any, i: number) => <li key={i}>{hw.description ?? String(hw)}</li>)}</ul>
            )}
          </div>
        )
      case 'exercises':
        // Injected: this portal's exercises save the student's answers and
        // their recordings against its own tables, so the live component is
        // passed in rather than drawn from the recap JSON.
        return exercises ?? null
      case 'vocabWords':
        if ((r.vocabulary || []).length === 0) return null
        return (
          <div className="lesson-block">
            <h3>Words from this lesson</h3>
            {(r.vocabulary || []).map((v: any, i: number) => (
              <div className="example" key={i}>
                <span className="jp">{v.word}</span> <span className="romaji">{v.reading}</span>
                {v.jlpt_level && <span className="jlpt sm"> {v.jlpt_level}</span>}
                <br />{v.definition}
                {v.example_sentence && <><br /><span className="jp" style={{ fontWeight: 600 }}>{v.example_sentence}</span></>}
              </div>
            ))}
          </div>
        )
    }
  }

  // Our arrangement, block by block. The teacher styles the recap; they do not
  // rearrange it — see LESSON_LAYOUT in lib/brand.
  //
  // Built up front so a movement with nothing in it drops out entirely: a
  // student whose teacher shared no files is not shown an empty Files heading.
  // Locked sections ignore their stored toggle: they are the recap, and a
  // brand saved before the lock existed may still carry a false for them.
  const built = LESSON_LAYOUT
    .filter(({ id }) => LESSON_LOCKED.has(id) || brand[LESSON_BLOCK_TOGGLE[id]] !== false)
    .map(({ id, w }) => ({ id, w, content: section(id) }))
    .filter((b) => b.content)

  // ── the recap, as one scroll in movements ───────────────────────────
  // Tabs are gone. The corrections — the most useful thing in any recap —
  // sat as a card behind the second tab, and most students never opened it.
  const byId = new Map(built.map((b) => [b.id, b] as const))

  /** One arranged block, carrying the studio's remove chrome where it applies. */
  const cell = (b: { id: LessonBlockId; w: number; content: React.ReactNode }) => {
    // Locked sections get no ✕ even in the studio — the notes, the practice
    // and the files are the recap, not options on it.
    const removable = Boolean(onRemoveSection) && !LESSON_LOCKED.has(b.id)
    return (
      <div key={b.id} style={{ ['--w' as any]: b.w }} className={removable ? 'k-zap' : undefined}>
        {removable && (
          <>
            <span className="k-zap-tag" aria-hidden>{LESSON_BLOCK_LABELS[b.id]}</span>
            <button
              type="button"
              className="k-zap-x"
              aria-label={`Remove ${LESSON_BLOCK_LABELS[b.id]}`}
              title={`Remove ${LESSON_BLOCK_LABELS[b.id]}`}
              onClick={() => onRemoveSection!(b.id)}
            >✕</button>
          </>
        )}
        {b.content}
      </div>
    )
  }

  const flowOf = (ids: LessonBlockId[]) => {
    const cells = ids.map((id) => byId.get(id)).filter(Boolean)
    return cells.length > 0 ? <div className="k-flow">{cells.map((b) => cell(b!))}</div> : null
  }

  const moves: { id: MovementId; label: string; count: string; node: React.ReactNode }[] = []
  const push = (id: MovementId, count: string, node: React.ReactNode) => {
    if (node) moves.push({ id, label: LESSON_MOVEMENTS.find((x) => x.id === id)!.label, count, node })
  }

  const shownMetrics = RECAP_METRICS.filter(({ id }) => !(brand.hiddenMetrics ?? []).includes(id))

  /**
   * How you spoke, as one panel.
   *
   * This was three near-identical white cards — speaking balance, score,
   * grammar density — and they were the thing that made the old recap read as
   * a stack of boxes. The score card also just repeated the score already in
   * the page header. So: one talk bar, the six measured tiles, and grammar as
   * a closing line. Each piece still answers its own toggle in the studio.
   */
  const spoke = (() => {
    const hasBalance = byId.has('balance')
    const hasScore = byId.has('score')
    const hasGrammar = byId.has('grammar')
    const metricGrid = byId.get('metrics')?.content
    if (!hasBalance && !hasScore && !hasGrammar && !metricGrid) return null
    return (
      <div className="kr-spoke">
        {(hasBalance || (hasScore && r.confidence_label)) && (
          <div className="kr-spoke-head">
            {hasBalance && <p className="kr-sublab">Who did the talking</p>}
            {/* The number is in the header already; the word for it is not. */}
            {hasScore && r.confidence_label && <span className="kr-verdict">{r.confidence_label}</span>}
          </div>
        )}
        {hasBalance && (
          <>
            <div className="kr-talk">
              <i style={{ width: `${studentTalk}%` }} />
              <i style={{ width: `${teacherTalk}%` }} />
            </div>
            <div className="kr-talk-key">
              <span><b />{studentFirst} {studentTalk}%</span>
              <span><b />{teacherFirst} {teacherTalk}%</span>
            </div>
          </>
        )}
        {metricGrid && (
          <>
            <p className="kr-sublab">Your speaking, measured</p>
            {metricGrid}
          </>
        )}
        {hasGrammar && r.grammar_density && (
          <p className="kr-grammar">
            <b>Grammar density</b>{r.grammar_density}
            {r.vocab_total_count ? ` · ${r.vocab_total_count} vocabulary items` : ''}
          </p>
        )}
      </div>
    )
  })()
  push('spoke', `${shownMetrics.length} measurements`, spoke)

  // The one block that becomes two movements. What went well and what to fix
  // are read at different moments, and LessonCorrections already renders
  // either half on its own — with the changed words still marked.
  if (byId.has('corrections')) {
    const zap = (node: React.ReactNode) =>
      onRemoveSection ? (
        <div className="k-zap">
          <span className="k-zap-tag" aria-hidden>{LESSON_BLOCK_LABELS.corrections}</span>
          <button
            type="button"
            className="k-zap-x"
            aria-label={`Remove ${LESSON_BLOCK_LABELS.corrections}`}
            title={`Remove ${LESSON_BLOCK_LABELS.corrections}`}
            onClick={() => onRemoveSection('corrections')}
          >✕</button>
          {node}
        </div>
      ) : node

    if (didWell.length > 0) {
      push('won', `${didWell.length} ${didWell.length === 1 ? 'thing' : 'things'}`,
        <LessonCorrections corrections={[]} didWell={didWell} who={studentFirst} />)
    }
    if (corrections.length > 0) {
      push('fix', `${corrections.length} ${corrections.length === 1 ? 'correction' : 'corrections'}`,
        zap(<LessonCorrections corrections={corrections} didWell={[]} who={studentFirst} />))
    } else if (didWell.length === 0 && legacyCorrections) {
      push('fix', '', zap(<FormattedContent content={legacyCorrections.content} />))
    }
  }

  push('covered', `${lessonSections.length} parts`, flowOf(['sections']))
  push('words', `${(r.vocabulary || []).length} words`, flowOf(['vocabWords']))
  push('practice', `${(r.exercises || []).length} exercises`, flowOf(['homework', 'exercises']))
  push('files', '', flowOf(['files']))

  // ── where you are in it ─────────────────────────────────────────────
  const flowRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLSpanElement>(null)
  const fillRef = useRef<HTMLSpanElement>(null)
  const trackRef = useRef<HTMLSpanElement>(null)
  const railRef = useRef<HTMLElement>(null)
  const mvRefs = useRef<(HTMLElement | null)[]>([])
  const [active, setActive] = useState(0)
  const [picking, setPicking] = useState(false)

  const track = useCallback(() => {
    const flow = flowRef.current
    if (!flow) return
    const box = flow.getBoundingClientRect()
    const vh = window.innerHeight || 1
    // Progress through the write-up itself, 0 to 1 — measured on the flow, so
    // the page header above it and anything below it are not counted.
    const span = Math.max(box.height - vh, 1)
    const pct = Math.min(1, Math.max(-box.top, 0) / span)
    if (barRef.current) barRef.current.style.width = `${pct * 100}%`
    if (fillRef.current) fillRef.current.style.height = `${pct * 100}%`
    // Whichever movement has crossed the top of the viewport is the one being
    // read; the last such wins.
    let best = 0
    mvRefs.current.forEach((el, i) => { if (el && el.getBoundingClientRect().top <= 90) best = i })
    setActive(best)
    setPicking(false)
  }, [])

  /**
   * Run the rail's track from the first pip to the last, measured rather than
   * offset from the top: anything above the list — the back link, a longer
   * heading — would otherwise slide the line off the dots it belongs to.
   */
  useEffect(() => {
    const place = () => {
      const rail = railRef.current
      const line = trackRef.current
      if (!rail || !line) return
      const pips = rail.querySelectorAll('.kr-pip')
      if (pips.length < 2) return
      const box = rail.getBoundingClientRect()
      const a = pips[0].getBoundingClientRect()
      const z = pips[pips.length - 1].getBoundingClientRect()
      const top = a.top - box.top + a.height / 2
      line.style.top = `${top}px`
      line.style.bottom = 'auto'
      line.style.height = `${z.top - box.top + z.height / 2 - top}px`
      line.style.left = `${a.left - box.left + a.width / 2 - 1}px`
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [moves.length])

  useEffect(() => {
    // The studio's preview is a scaled panel, not the page — window scroll
    // says nothing about it, so it rests on the first movement.
    if (preview) return
    track()
    window.addEventListener('scroll', track, { passive: true })
    window.addEventListener('resize', track)
    return () => {
      window.removeEventListener('scroll', track)
      window.removeEventListener('resize', track)
    }
  }, [preview, track])

  const jump = useCallback((i: number) => {
    const el = mvRefs.current[i]
    if (!el) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 62, behavior: reduce ? 'auto' : 'smooth' })
  }, [])

  // The studio still thinks in tabs and jumps its preview to the one a section
  // belongs to. Mapping that to a movement keeps every one of those jumps
  // landing on something without the studio having to change.
  const moveIds = moves.map((mv) => mv.id).join(',')
  useEffect(() => {
    if (!controlledTab || preview) return
    const i = moveIds.split(',').indexOf(TAB_MOVEMENT[controlledTab])
    if (i >= 0) jump(i)
  }, [controlledTab, preview, moveIds, jump])

  if (moves.length === 0) return null
  const now = moves[Math.min(active, moves.length - 1)]

  return (
    <div className="kr">
      <div className="kr-body">
        {/* Wide: the same thing unrolled, so all of it is visible at once. */}
        <nav className="kr-rail" aria-label="Lesson sections" ref={railRef}>
          {back && (
            <a className="kr-rail-back" href={back.href}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
                   strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M15 5l-7 7 7 7" />
              </svg>
              {back.label}
            </a>
          )}
          <p className="kr-rail-h">This lesson</p>
          <span className="kr-rail-track" ref={trackRef}><span className="kr-rail-fill" ref={fillRef} /></span>
          {moves.map((mv, i) => (
            <button
              key={mv.id}
              type="button"
              className={`kr-r${i === active ? ' on' : ''}`}
              aria-current={i === active ? 'true' : undefined}
              onClick={() => jump(i)}
            >
              <span className="kr-pip" aria-hidden />
              <span className="kr-lab">{mv.label}</span>
              {mv.count && <span className="kr-cnt">{mv.count}</span>}
            </button>
          ))}
        </nav>

        <div className="kr-flow" ref={flowRef}>
          {moves.map((mv, i) => (
            <section
              key={mv.id}
              className={`kr-mv kr-mv--${mv.id}`}
              ref={(el) => { mvRefs.current[i] = el }}
              aria-label={mv.label}
            >
              <h3 className="kr-mv-h">{mv.label}{mv.count && <s>{mv.count}</s>}</h3>
              {mv.node}
            </section>
          ))}
        </div>
      </div>

      {/* Narrow: the movement you are in, and a way to go to another one.
          Last in the DOM and stuck to the BOTTOM of the screen — a control at
          the top of a phone is a stretch every time you want it, and this one
          is meant to be used while reading. Being last also means the space it
          reserves falls after the content instead of leaving a gap above it.
          The progress hairline runs along its top edge, where it doubles as
          the seam between the bar and what you are reading. */}
      <div className="kr-strip">
        <div className="kr-bar"><span ref={barRef} /></div>
        <div className="kr-row">
        {back && (
          // Icon only: the label would crowd the movement name, and a left
          // chevron in the bottom bar is not ambiguous.
          <a className="kr-back-btn" href={back.href} aria-label={`Back to ${back.label}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
                 strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </a>
        )}
        <button
          type="button"
          className={`kr-now${picking ? ' open' : ''}`}
          aria-expanded={picking}
          aria-haspopup="menu"
          onClick={() => setPicking((o) => !o)}
        >
          <span className="kr-name">{now.label}</span>
          {now.count && <span className="kr-count">{now.count}</span>}
          <svg className="kr-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M5 9l7 7 7-7" />
          </svg>
        </button>
        </div>
        {picking && (
          <div className="kr-picker" role="menu">
            {moves.map((mv, i) => (
              <button
                key={mv.id}
                type="button"
                role="menuitem"
                className={i === active ? 'on' : undefined}
                onClick={() => { setPicking(false); jump(i) }}
              >
                <span>{mv.label}</span>
                {mv.count && <s>{mv.count}</s>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
