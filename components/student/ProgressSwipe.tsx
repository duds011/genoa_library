'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import CountUp from '@/components/CountUp'

interface ChartLesson {
  lessonNumber: number
  score: number | null
  talkPct: number | null
  vocabCount: number
  wpm?: number | null
  responseSec?: number | null
}

interface Props {
  lessons: ChartLesson[] // descending order — we reverse for charts
}

type Metric = {
  key: string
  label: string
  color: string
  suffix?: string
  domain?: [number, number]
  /** For thinking time, going down is the win. */
  lowerIsBetter?: boolean
  format?: (v: number) => number
  decimals?: number
  note: string
}

/**
 * Five accents from the app's own set. No green: the palette moved to blue and
 * green now only ever means "published".
 */
const METRICS: Metric[] = [
  { key: 'score', label: 'Score', color: '#4f46e5', suffix: '/10', domain: [0, 10], decimals: 1, note: 'What each lesson was marked out of ten.' },
  { key: 'talkPct', label: 'You talk', color: '#7c3aed', suffix: '%', domain: [0, 100], format: Math.round, note: 'Your share of the talking. More of it is yours as you get more confident.' },
  { key: 'wpm', label: 'Pace', color: '#a78bfa', suffix: ' wpm', format: Math.round, note: 'Words a minute while you were speaking.' },
  { key: 'responseSec', label: 'Thinking', color: '#f59e0b', suffix: 's', lowerIsBetter: true, decimals: 1, note: 'How long before you answer. Shorter means the words are coming faster.' },
  { key: 'cumVocab', label: 'Vocabulary', color: '#ec4899', suffix: ' words', format: Math.round, note: 'Every word from every lesson, added up.' },
]

function SparkTooltip({ active, payload, label, suffix = '' }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 9, boxShadow: 'var(--shadow)', padding: '5px 9px', fontSize: 10.5, lineHeight: 1.4 }}>
      <span style={{ color: 'var(--muted)', fontWeight: 700 }}>L{label} · </span>
      <span style={{ color: 'var(--ink)', fontWeight: 800 }}>{payload[0].value}{suffix}</span>
    </div>
  )
}

/** True when the reader has asked the OS for less motion. */
function useReducedMotion() {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const read = () => setReduced(mq.matches)
    read()
    mq.addEventListener('change', read)
    return () => mq.removeEventListener('change', read)
  }, [])
  return reduced
}

/**
 * One metric, full width. `nonce` changes every time this slide becomes the
 * live one, which remounts the chart and the number so both replay their
 * entrance — the point of swiping is to watch each metric arrive.
 */
function Slide({ metric, data, nonce, animate }: { metric: Metric; data: any[]; nonce: number; animate: boolean }) {
  const vals = data.map((d) => d[metric.key]).filter((v) => v != null) as number[]
  const gid = `spark-${metric.key}`

  if (vals.length === 0) {
    return (
      <section className="k-swipe-slide" aria-label={metric.label}>
        <p className="k-swipe-label">{metric.label}</p>
        <div className="k-swipe-empty">Nothing recorded for this yet.</div>
      </section>
    )
  }

  const latest = vals[vals.length - 1]
  const delta = vals.length > 1 ? latest - vals[0] : 0

  // Plotted against its own range with a margin, not against the whole scale:
  // eight-point-something out of ten drawn on a 0–10 axis is a flat line, and
  // the movement is the thing worth seeing. `domain` stays as the clamp so the
  // padding can never run past what the metric can actually be.
  const lo = Math.min(...vals)
  const hi = Math.max(...vals)
  const pad = Math.max((hi - lo) * 0.35, Math.abs(hi) * 0.06, 0.5)
  const bounds = metric.domain
  const yDomain: [number, number] = [
    bounds ? Math.max(bounds[0], lo - pad) : lo - pad,
    bounds ? Math.min(bounds[1], hi + pad) : hi + pad,
  ]
  const improved = metric.lowerIsBetter ? delta < 0 : delta > 0
  // Subtracting two floats prints 1.2000000000000002 unless it is rounded.
  const fmt = metric.format ?? ((v: number) => Number(v.toFixed(metric.decimals ?? 1)))

  return (
    <section className="k-swipe-slide" aria-label={metric.label}>
      {/* Distinct key prefixes: the head and the chart are siblings, and two
          siblings sharing a key is undefined behaviour — React kept both. */}
      <div key={`head-${nonce}`} className="k-swipe-head">
        <p className="k-swipe-label">{metric.label}</p>
        <p className="k-swipe-value" style={{ color: metric.color }}>
          {animate
            ? <CountUp value={latest} decimals={metric.decimals ?? 0} />
            : fmt(latest)}
          <span className="k-swipe-unit">{metric.suffix}</span>
        </p>
        {delta !== 0 && (
          <span className={`k-swipe-delta ${improved ? 'up' : 'down'}`}>
            {delta > 0 ? '▲' : '▼'} {fmt(Math.abs(delta))}{metric.suffix} since lesson {data[0].lessonNumber}
          </span>
        )}
      </div>

      {vals.length < 2 ? (
        <div className="k-swipe-empty">The trend appears after your next lesson.</div>
      ) : (
        <div className="k-swipe-chart" key={`chart-${nonce}`}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 6, left: 6, bottom: 0 }}>
              <defs>
                <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={metric.color} stopOpacity={0.34} />
                  <stop offset="100%" stopColor={metric.color} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <XAxis dataKey="lessonNumber" tick={{ fontSize: 10, fill: 'var(--muted)', fontWeight: 700 }} axisLine={false} tickLine={false} />
              <YAxis domain={yDomain} hide />
              <Tooltip content={<SparkTooltip suffix={metric.suffix} />} cursor={{ stroke: metric.color, strokeOpacity: 0.25 }} />
              <Area
                type="monotone" dataKey={metric.key} stroke={metric.color} strokeWidth={2.5}
                fill={`url(#${gid})`} connectNulls
                isAnimationActive={animate}
                animationDuration={900}
                animationEasing="ease-out"
                dot={{ r: 3, fill: metric.color, stroke: '#fff', strokeWidth: 1.5 }}
                activeDot={{ r: 5, fill: metric.color, stroke: '#fff', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <p className="k-swipe-note">{metric.note}</p>
    </section>
  )
}

/**
 * The progress charts, one per screen instead of five at once.
 *
 * Five sparklines side by side asked a student to compare things they have no
 * reason to compare, and none of them was big enough to read. This is a
 * scroll-snap track: swipe on a phone, drag or use the tabs and arrow keys on a
 * laptop, one metric filling the card each time. Native scroll-snap does the
 * swiping, so there is no drag maths here and momentum feels like the OS.
 */
export default function ProgressCharts({ lessons }: Props) {
  const trackRef = useRef<HTMLDivElement | null>(null)
  const [active, setActive] = useState(0)
  /** Bumped each time a slide becomes live, to replay its entrance. */
  const [nonces, setNonces] = useState<number[]>(() => METRICS.map(() => 0))
  const reduced = useReducedMotion()

  // Which slide is under the viewport, derived from scroll position rather
  // than tracked during the gesture — the browser owns the gesture.
  const syncActive = useCallback(() => {
    const el = trackRef.current
    if (!el) return
    const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth))
    setActive((prev) => (prev === i ? prev : Math.max(0, Math.min(METRICS.length - 1, i))))
  }, [])

  useEffect(() => {
    setNonces((prev) => {
      const next = prev.slice()
      next[active] = next[active] + 1
      return next
    })
  }, [active])

  const goTo = (i: number) => {
    const el = trackRef.current
    if (!el) return
    el.scrollTo({ left: i * el.clientWidth, behavior: reduced ? 'auto' : 'smooth' })
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); goTo(Math.min(METRICS.length - 1, active + 1)) }
    if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(Math.max(0, active - 1)) }
  }

  if (lessons.length < 2) return null

  const data = [...lessons].reverse() // chronological
  let running = 0
  const withVocab = data.map((l) => {
    running += l.vocabCount
    return { ...l, cumVocab: running }
  })

  return (
    <div className="k-swipe">
      <div className="k-swipe-tabs" role="tablist" aria-label="Progress metrics">
        {METRICS.map((m, i) => (
          <button
            key={m.key}
            type="button"
            role="tab"
            aria-selected={i === active}
            className={i === active ? 'on' : ''}
            style={i === active ? { ['--on' as any]: m.color } : undefined}
            onClick={() => goTo(i)}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div
        className="k-swipe-track"
        ref={trackRef}
        onScroll={syncActive}
        onKeyDown={onKeyDown}
        tabIndex={0}
        aria-label="Swipe or use the arrow keys to move between metrics"
      >
        {METRICS.map((m, i) => (
          <Slide key={m.key} metric={m} data={withVocab} nonce={nonces[i]} animate={!reduced} />
        ))}
      </div>

      <div className="k-swipe-dots" aria-hidden>
        {METRICS.map((m, i) => (
          <button
            key={m.key}
            type="button"
            tabIndex={-1}
            className={i === active ? 'on' : ''}
            style={i === active ? { background: m.color } : undefined}
            onClick={() => goTo(i)}
          />
        ))}
      </div>
    </div>
  )
}
