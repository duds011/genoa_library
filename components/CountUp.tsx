'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * A number that counts up to its value once, when it first scrolls into view.
 *
 * Server and first client render both emit 0, so hydration matches and the
 * count is the first thing that happens rather than a correction. Anyone who
 * asked for less motion gets the final value immediately.
 */
export default function CountUp({
  value, decimals = 0, duration = 950, prefix = '', suffix = '',
}: {
  value: number
  decimals?: number
  duration?: number
  prefix?: string
  suffix?: string
}) {
  const [shown, setShown] = useState(0)
  const [done, setDone] = useState(false)
  const host = useRef<HTMLSpanElement | null>(null)

  useEffect(() => {
    const el = host.current
    if (!el) return
    if (!Number.isFinite(value)) { setShown(value); setDone(true); return }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(value); setDone(true); return
    }

    let raf = 0
    let startedAt = 0
    let running = false
    const run = (t: number) => {
      if (!startedAt) startedAt = t
      const p = Math.min(1, (t - startedAt) / duration)
      // easeOutCubic — quick off the mark, settles gently on the number.
      setShown(value * (1 - Math.pow(1 - p, 3)))
      if (p < 1) raf = requestAnimationFrame(run)
      else setDone(true)
    }

    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return
      io.disconnect()
      running = true
      raf = requestAnimationFrame(run)
    }, { threshold: 0.2 })
    io.observe(el)

    // The number matters more than the flourish. If nothing has started by now
    // — never scrolled to, an observer that didn't fire, frames not being
    // served — show the real value rather than leaving a 0 on screen.
    const failsafe = window.setTimeout(() => {
      if (running) return
      io.disconnect()
      setShown(value)
      setDone(true)
    }, 1200)

    return () => { io.disconnect(); clearTimeout(failsafe); cancelAnimationFrame(raf) }
  }, [value, duration])

  return (
    <span ref={host} className={`k-count ${done ? 'done' : ''}`}>
      {prefix}{shown.toFixed(decimals)}{suffix}
    </span>
  )
}
