'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
// The flow's styles travel with the component rather than living in
// globals.css, so this feature is one folder rather than two files far apart.
import '@/app/recap-flow.css'

/**
 * The recap as ONE scroll, in movements.
 *
 * It was five tabs. Tabs made every part of a lesson equally hidden: you had
 * to know something was in "Vocabulary" to go and look, and nothing ever
 * followed on from anything else. A recap is a story about an hour — how you
 * spoke, what you got right, what to fix, what you covered — so it reads top
 * to bottom now, and the navigation says where you ARE rather than what you
 * could open.
 *
 * Two shapes, because a rail and a phone want opposite things:
 *  - wide: a sticky rail down the left, with a line that fills as you read.
 *  - narrow: a bar stuck to the BOTTOM of the screen. A control at the top of
 *    a phone is a stretch every time you want it, and this one is meant to be
 *    used while reading. Being last in the DOM also means the space it
 *    reserves falls after the content rather than leaving a gap above it.
 *
 * A movement with nothing in it is dropped entirely, which is what lets a
 * lesson recorded before any of this still render: it simply has fewer
 * movements.
 */

export type Movement = {
  id: string
  label: string
  /** Shown beside the label — "12 words", "3 to fix". Omit for none. */
  count?: string | null
  node: React.ReactNode
}

export default function RecapFlow({
  movements,
  back,
}: {
  movements: Movement[]
  back?: { href: string; label: string }
}) {
  const moves = movements.filter((m) => m.node)
  const [active, setActive] = useState(0)
  const [picking, setPicking] = useState(false)

  const flowRef = useRef<HTMLDivElement>(null)
  const railRef = useRef<HTMLElement>(null)
  const trackRef = useRef<HTMLSpanElement>(null)
  const fillRef = useRef<HTMLSpanElement>(null)
  const barRef = useRef<HTMLSpanElement>(null)
  const mvRefs = useRef<(HTMLElement | null)[]>([])

  /** Where the reader is, measured on the flow rather than the whole page. */
  const track = useCallback(() => {
    const flow = flowRef.current
    if (!flow) return
    const box = flow.getBoundingClientRect()
    const vh = window.innerHeight || 1
    // Progress through the write-up itself, 0 to 1 — so the header above it
    // and anything below it are not counted as part of the read.
    const span = Math.max(box.height - vh, 1)
    const pct = Math.min(1, Math.max(-box.top, 0) / span)
    if (barRef.current) barRef.current.style.width = `${pct * 100}%`
    if (fillRef.current) fillRef.current.style.height = `${pct * 100}%`
    // Whichever movement has crossed the top of the viewport is the one being
    // read; the last such wins.
    let best = 0
    mvRefs.current.forEach((el, i) => {
      if (el && el.getBoundingClientRect().top <= 90) best = i
    })
    setActive(best)
  }, [])

  /**
   * Run the rail's line from the first pip to the last, measured rather than
   * offset from the top — anything above the list would otherwise slide the
   * line off the dots it belongs to.
   */
  useEffect(() => {
    const place = () => {
      const rail = railRef.current
      const line = trackRef.current
      if (!rail || !line) return
      const pips = rail.querySelectorAll('.gr-pip')
      if (pips.length < 2) return
      const box = rail.getBoundingClientRect()
      const a = pips[0].getBoundingClientRect()
      const z = pips[pips.length - 1].getBoundingClientRect()
      const top = a.top - box.top + a.height / 2
      line.style.top = `${top}px`
      line.style.height = `${z.top - box.top + z.height / 2 - top}px`
      line.style.left = `${a.left - box.left + a.width / 2 - 1}px`
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [moves.length])

  useEffect(() => {
    track()
    window.addEventListener('scroll', track, { passive: true })
    window.addEventListener('resize', track)
    return () => {
      window.removeEventListener('scroll', track)
      window.removeEventListener('resize', track)
    }
  }, [track])

  const jump = useCallback((i: number) => {
    const el = mvRefs.current[i]
    if (!el) return
    setPicking(false)
    const y = el.getBoundingClientRect().top + window.scrollY - 64
    window.scrollTo({ top: y, behavior: 'smooth' })
  }, [])

  if (!moves.length) return null
  const now = moves[Math.min(active, moves.length - 1)]

  return (
    <div className="gr">
      <div className="gr-body">
        <nav className="gr-rail" ref={railRef} aria-label="Sections of this recap">
          {back && (
            <a className="gr-rail-back" href={back.href}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
                   strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M15 5l-7 7 7 7" />
              </svg>
              <span>{back.label}</span>
            </a>
          )}
          <p className="gr-rail-h">This lesson</p>
          <span className="gr-rail-track" ref={trackRef}>
            <span className="gr-rail-fill" ref={fillRef} />
          </span>
          {moves.map((mv, i) => (
            <button
              key={mv.id}
              type="button"
              className={`gr-r${i === active ? ' on' : ''}`}
              aria-current={i === active ? 'true' : undefined}
              onClick={() => jump(i)}
            >
              <span className="gr-pip" aria-hidden />
              <span className="gr-lab">{mv.label}</span>
              {mv.count && <span className="gr-cnt">{mv.count}</span>}
            </button>
          ))}
        </nav>

        <div className="gr-flow" ref={flowRef}>
          {moves.map((mv, i) => (
            <section
              key={mv.id}
              className={`gr-mv gr-mv--${mv.id}`}
              ref={(el) => { mvRefs.current[i] = el }}
              aria-label={mv.label}
            >
              <h3 className="gr-mv-h">
                {mv.label}
                {mv.count && <s>{mv.count}</s>}
              </h3>
              {mv.node}
            </section>
          ))}
        </div>
      </div>

      {/* Narrow screens: where you are, and a way to somewhere else. Last in
          the DOM and stuck to the bottom; the progress hairline runs along its
          top edge, where it doubles as the seam. */}
      <div className="gr-strip">
        <div className="gr-bar"><span ref={barRef} /></div>
        <div className="gr-row">
          {back && (
            <a className="gr-back-btn" href={back.href} aria-label={`Back to ${back.label}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
                   strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M15 5l-7 7 7 7" />
              </svg>
            </a>
          )}
          <button
            type="button"
            className={`gr-now${picking ? ' open' : ''}`}
            aria-expanded={picking}
            aria-haspopup="menu"
            onClick={() => setPicking((o) => !o)}
          >
            <span className="gr-name">{now.label}</span>
            {now.count && <span className="gr-count">{now.count}</span>}
            <svg className="gr-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M5 9l7 7 7-7" />
            </svg>
          </button>
        </div>
        {picking && (
          <div className="gr-picker" role="menu">
            {moves.map((mv, i) => (
              <button
                key={mv.id}
                type="button"
                role="menuitem"
                className={i === active ? 'on' : undefined}
                onClick={() => jump(i)}
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
