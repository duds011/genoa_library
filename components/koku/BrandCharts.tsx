'use client'

/**
 * Brand-themed charts shared by the real student dashboard and the miniature
 * of it in the branding studio. Each one takes an explicit height so a
 * teacher-resized block can hand its own space down, and a `compact` flag that
 * strips axes and tooltips for the preview-sized copy.
 *
 * These replace the plain fill bars the dashboard used to draw for scores,
 * milestone progress and vocabulary.
 */

import {
  Area, AreaChart, Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { levelProgress, type Level } from '@/lib/brand'
import { levelColor, levelScale } from './VocabLevelBreakdown'

const AXIS = { fontSize: 10, fill: 'var(--muted)', fontWeight: 700 }

/** Shared tooltip — the portal's card look, not Recharts' default box. */
function ChartTip({ active, payload, label, suffix = '', prefix = '' }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 9, boxShadow: 'var(--shadow)', padding: '5px 9px', fontSize: 10.5, lineHeight: 1.4 }}>
      <span style={{ color: 'var(--muted)', fontWeight: 700 }}>{prefix}{label} · </span>
      <span style={{ color: 'var(--ink)', fontWeight: 800 }}>{payload[0].value}{suffix}</span>
    </div>
  )
}

export type ScorePoint = { lesson: number; score: number }

/**
 * How many lessons the chart makes room for before it starts scrolling its
 * oldest off. A student with two lessons should see two bars in a chart with
 * space left in it, not two slabs stretched over the whole width — the shape
 * of the chart should say "early days", and a full-width block says the
 * opposite.
 */
const SCORE_SLOTS = 8

/**
 * Recent lesson scores as bars. The most recent lesson is the accent colour at
 * full strength; older ones fade back so the latest reads first.
 *
 * The data is padded to a fixed number of slots so bar width never depends on
 * how many lessons exist: bars keep their size and accumulate left to right as
 * lessons are taken.
 */
export function ScoreTrendChart({
  points, color, height = 150, compact = false,
}: { points: ScorePoint[]; color: string; height?: number | string; compact?: boolean }) {
  if (points.length === 0) return null
  const last = points.length - 1

  const data: { lesson: number; score: number | null }[] = points.slice(-SCORE_SLOTS)
  // Empty slots carry a negative key so they stay unique and can be told apart
  // from real lessons when labelling the axis.
  for (let i = data.length; i < SCORE_SLOTS; i++) data.push({ lesson: -1 - i, score: null })

  return (
    <ResponsiveContainer width="100%" height={height as number}>
      <BarChart
        data={data}
        margin={compact ? { top: 4, right: 0, left: 0, bottom: 0 } : { top: 6, right: 4, left: -22, bottom: 0 }}
        barCategoryGap="26%"
      >
        <XAxis
          dataKey="lesson" tickLine={false} axisLine={false} tick={compact ? false : AXIS}
          height={compact ? 0 : 18} tickFormatter={(v) => (Number(v) > 0 ? `L${v}` : '')}
        />
        <YAxis domain={[0, 10]} tickLine={false} axisLine={false} tick={compact ? false : AXIS} width={compact ? 0 : 30} />
        {!compact && <Tooltip cursor={{ fill: `${color}14` }} content={<ChartTip prefix="Lesson " suffix="/10" />} />}
        <Bar dataKey="score" radius={[4, 4, 0, 0]} maxBarSize={compact ? 12 : 34} isAnimationActive={!compact}>
          {data.map((p, i) => (
            <Cell key={p.lesson} fill={color} fillOpacity={i === last ? 1 : 0.42} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

/**
 * The milestone ladder as a filling track: one segment per level the teacher
 * set, each filling with the lessons taken towards it. Replaces the donut —
 * a bar says "3 of 5 lessons" without the student doing the arithmetic.
 */
export function MilestoneTrack({
  levels, lessonCount, color, compact = false,
}: { levels: Level[]; lessonCount: number; color: string; compact?: boolean }) {
  const { rungs } = levelProgress(levels, lessonCount)
  return (
    <div className="k-track">
      <div className="k-track-bar">
        {rungs.map((rung, i) => {
          const from = i === 0 ? 0 : rungs[i - 1].lessons
          const span = Math.max(1, rung.lessons - from)
          const fill = Math.max(0, Math.min(100, ((lessonCount - from) / span) * 100))
          return (
            <span key={`${rung.name}-${rung.lessons}`} className="k-track-seg">
              <i style={{ width: `${fill}%`, background: color }} />
            </span>
          )
        })}
      </div>
      {!compact && (
        <div className="k-track-legend">
          {rungs.map((rung) => (
            <span key={`${rung.name}-${rung.lessons}`} className={`k-track-rung ${lessonCount >= rung.lessons ? 'on' : ''}`}>
              <b>{rung.lessons}</b>
              <small title={rung.name}>{rung.name}</small>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

/** Vocabulary by level as bars, one colour per level. */
export function VocabLevelChart({
  distribution, height = 150, compact = false,
}: { distribution: Record<string, number>; height?: number | string; compact?: boolean }) {
  const data = levelScale(distribution)
    .map((level) => ({ level, count: distribution[level] ?? 0 }))
    .filter((d) => d.count > 0)
  if (data.length === 0) return null

  return (
    <ResponsiveContainer width="100%" height={height as number}>
      <BarChart data={data} margin={compact ? { top: 4, right: 0, left: 0, bottom: 0 } : { top: 6, right: 4, left: -24, bottom: 0 }}>
        <XAxis dataKey="level" tickLine={false} axisLine={false} tick={compact ? false : AXIS} height={compact ? 0 : 18} />
        <YAxis tickLine={false} axisLine={false} tick={compact ? false : AXIS} width={compact ? 0 : 30} allowDecimals={false} />
        {!compact && <Tooltip cursor={{ fill: 'rgba(0,0,0,.04)' }} content={<ChartTip suffix=" words" />} />}
        <Bar dataKey="count" radius={[5, 5, 2, 2]} maxBarSize={compact ? 14 : 38} isAnimationActive={!compact}>
          {data.map((d) => (
            <Cell key={d.level} fill={levelColor(d.level)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

/**
 * The miniature stand-in for the full ProgressCharts grid. The real component
 * draws five sparklines; at preview size one accent-coloured area reads better
 * than five unreadable ones.
 */
export function MiniTrend({
  points, color, height = 62,
}: { points: { x: number; y: number }[]; color: string; height?: number | string }) {
  const gid = 'k-mini-trend'
  return (
    <ResponsiveContainer width="100%" height={height as number}>
      <AreaChart data={points} margin={{ top: 4, right: 2, left: 2, bottom: 0 }}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.34} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <XAxis dataKey="x" hide />
        <YAxis hide domain={['auto', 'auto']} />
        <Area
          type="monotone" dataKey="y" stroke={color} strokeWidth={2} fill={`url(#${gid})`}
          isAnimationActive={false}
          dot={{ r: 2, fill: color, stroke: '#fff', strokeWidth: 1.2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
