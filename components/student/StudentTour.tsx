'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { completeStudentTour } from '@/app/actions/tour'

type Step = {
  /** matches a data-tour="…" on the dashboard. Omitted = centred, no spotlight. */
  target?: string
  emoji: string
  title: string
  body: string
}

// A brand-new student has no lessons, tests or vocabulary yet, so several of
// these sections aren't on the page. Any step whose target is missing is
// dropped on mount rather than spotlighting nothing.
const STEPS: Step[] = [
  {
    emoji: '👋',
    title: 'Welcome to your library',
    body: "Everything from your lessons with Noa lives here — progress, vocabulary, grammar, homework and tests. Here's a quick tour, it takes about 30 seconds.",
  },
  {
    target: 'stats',
    emoji: '📊',
    title: 'Your progress at a glance',
    body: 'How many lessons you have done, the score Noa gives each lesson out of 10, your average, and how much of the lesson you spent talking. That last one is the goal — the more you talk, the faster you improve.',
  },
  {
    target: 'milestones',
    emoji: '🌱',
    title: 'Milestones',
    body: 'Every lesson moves you along this track. Reach 5, 10, 25 and 50 lessons to unlock the next badge.',
  },
  {
    target: 'vocab',
    emoji: '📚',
    title: 'Your vocabulary',
    body: 'Words from your lessons are grouped by JLPT level. Tap a level to see the saved words, readings, examples, and the lesson where each one appeared.',
  },
  {
    target: 'learning-map',
    emoji: '🧭',
    title: 'Your grammar map',
    body: 'This table shows the grammar and expressions you have covered by category. Tap a row to open the list, see the romaji, and jump back to the lesson where it appeared.',
  },
  {
    target: 'tests',
    emoji: '📝',
    title: 'Tests from Noa',
    body: "When Noa sends you a test it appears here. It is timed, and it is built from your own lessons — speaking, reading and grammar. If you get stuck, tap “Need a hint?” for a nudge.",
  },
  {
    target: 'lessons-link',
    emoji: '📖',
    title: 'Your lessons',
    body: 'Tap here to open your full lesson list. Each lesson shows what you covered, the vocabulary from it, your homework, and a recorder to practise speaking out loud.',
  },
  {
    emoji: '🎉',
    title: "You're all set",
    body: "That's everything. This tour won't appear again — if you ever get lost, just ask Noa in your next lesson.",
  },
]

type Rect = { top: number; left: number; width: number; height: number }

const PAD = 8

// useLayoutEffect warns when React renders on the server; this component is
// client-only in practice but still gets server-rendered to null.
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

function sameRect(a: Rect | null, b: Rect | null) {
  if (a === b) return true
  if (!a || !b) return false
  return a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height
}

export default function StudentTour({ show }: { show: boolean }) {
  const [steps, setSteps] = useState<Step[] | null>(null)
  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState<Rect | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const [cardH, setCardH] = useState(0)

  // Keep only the steps whose section actually rendered for this student.
  useEffect(() => {
    if (!show) return
    setSteps(STEPS.filter(s => !s.target || document.querySelector(`[data-tour="${s.target}"]`)))
  }, [show])

  const step = steps?.[index]
  const open = show && !dismissed && !!step

  const finish = useCallback(() => {
    setDismissed(true)
    // Fire and forget: the tour is already gone from the student's screen, and
    // if this fails they simply see it once more next time.
    completeStudentTour().catch(() => {})
  }, [])

  // Bring the highlighted section into view when the step changes.
  useEffect(() => {
    if (!open || !step?.target) return
    document
      .querySelector(`[data-tour="${step.target}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [open, step])

  // Keep the hole glued to its target while the page smooth-scrolls, resizes or
  // settles. Measuring runs in short bursts rather than a permanent rAF loop:
  // an always-on loop never lets the page go idle and quietly drains the
  // battery for as long as the tour is open.
  useEffect(() => {
    if (!open) return
    let raf = 0
    let until = 0

    const measure = () => {
      const el = step?.target
        ? document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`)
        : null
      const r = el?.getBoundingClientRect()
      const next = r ? { top: r.top, left: r.left, width: r.width, height: r.height } : null
      setRect(prev => (sameRect(prev, next) ? prev : next))
    }

    const loop = () => {
      measure()
      if (performance.now() < until) raf = requestAnimationFrame(loop)
    }

    // Re-arm on anything that can move the target; scrolling fires throughout a
    // smooth scroll, which keeps the burst alive until it lands. Measure once
    // up front rather than waiting on a frame: rAF is paused while the tab is
    // in the background, and without this the spotlight would not appear at all
    // until the student touched something.
    const kick = () => {
      measure()
      until = performance.now() + 700
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(loop)
    }

    kick()
    window.addEventListener('scroll', kick, true)
    window.addEventListener('resize', kick)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', kick, true)
      window.removeEventListener('resize', kick)
    }
  }, [open, step])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish()
      if (e.key === 'ArrowRight') setIndex(i => Math.min(i + 1, (steps?.length ?? 1) - 1))
      if (e.key === 'ArrowLeft') setIndex(i => Math.max(i - 1, 0))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, steps, finish])

  // Measure the card so it can be placed against its real height rather than a
  // guess. Runs after each render; the equality check stops it looping.
  useIsoLayoutEffect(() => {
    const h = cardRef.current?.offsetHeight
    if (h && h !== cardH) setCardH(h)
  })

  if (!open || typeof document === 'undefined') return null

  const total = steps!.length
  const isLast = index === total - 1
  const card = cardPosition(rect, cardH)

  return createPortal(
    <div className="fixed inset-0 z-[100] overflow-hidden" role="dialog" aria-modal="true" aria-label="Portal tour">
      {/* The blackout. With a target it's a giant shadow cast from the hole, so
          the section stays lit and everything else goes dark. */}
      {rect ? (
        <div
          // Distinct keys stop React reusing one div across the two branches:
          // reuse makes the spotlight inherit the plain backdrop's inset-0 and
          // then transition in from the top-left corner on the first step.
          key="spotlight"
          className="pointer-events-none absolute rounded-2xl"
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            boxShadow: '0 0 0 9999px rgba(15,23,42,0.82)',
            outline: '2px solid rgba(255,255,255,0.9)',
            outlineOffset: 2,
            transition: 'top 180ms ease, left 180ms ease, width 180ms ease, height 180ms ease',
          }}
        />
      ) : (
        <div key="backdrop" className="absolute inset-0" style={{ background: 'rgba(15,23,42,0.82)' }} />
      )}

      <div
        ref={cardRef}
        className="absolute w-[min(360px,calc(100vw-32px))] rounded-2xl bg-white p-5 shadow-2xl"
        style={card}
      >
        <button
          onClick={finish}
          aria-label="Skip tour"
          className="absolute top-3 right-3 text-gray-300 hover:text-gray-500"
        >
          <X className="h-4 w-4" />
        </button>

        <p className="text-2xl leading-none">{step!.emoji}</p>
        <h2 className="mt-2 text-base font-bold text-ink">{step!.title}</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">{step!.body}</p>

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5" aria-hidden>
            {steps!.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? 'w-4 bg-brand-600' : 'w-1.5 bg-gray-200'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            {index > 0 && (
              <button onClick={() => setIndex(i => i - 1)} className="btn-ghost text-xs">
                <ChevronLeft className="h-3.5 w-3.5" /> Back
              </button>
            )}
            {isLast ? (
              <button onClick={finish} className="btn-primary text-xs">
                Start learning
              </button>
            ) : (
              <button onClick={() => setIndex(i => i + 1)} className="btn-primary text-xs">
                Next <ChevronRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {!isLast && (
          <button onClick={finish} className="mt-2 text-[11px] font-semibold text-gray-400 hover:text-muted">
            Skip tour
          </button>
        )}
      </div>
    </div>,
    document.body,
  )
}

// Park the card in the gap above or below the spotlight, whichever genuinely
// fits. This needs the card's real height — on a narrow phone the body text
// wraps and the card grows well past any hardcoded guess, which is how it ends
// up hanging off the bottom of the screen.
function cardPosition(rect: Rect | null, cardH: number): React.CSSProperties {
  if (typeof window === 'undefined' || !rect) {
    return { top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }
  }

  const vw = window.innerWidth
  const vh = window.innerHeight
  const gap = 14
  const edge = 8
  const width = Math.min(360, vw - 32)
  const left = Math.min(Math.max(rect.left, 16), Math.max(16, vw - width - 16))

  const need = cardH + gap + edge
  const below = vh - (rect.top + rect.height)
  const above = rect.top

  if (below >= need) return { top: rect.top + rect.height + gap, left }
  if (above >= need) return { top: rect.top - cardH - gap, left }
  // Neither gap fits (tall section, short screen): sit against the bottom edge
  // and accept overlapping the spotlight — better than running off-screen.
  return { top: Math.max(edge, vh - cardH - edge), left }
}
