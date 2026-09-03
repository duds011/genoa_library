'use client'

import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts'

// ── Colour palettes ──────────────────────────────────────────────────────────

// One colour per student — 22, so none of the 21 active students share one.
// Bright and saturated, but each dark enough to stay legible as a 2px line on
// white. Consecutive entries jump hue so neighbours never look alike.
const STUDENT_COLORS = [
  '#FF3B30', // red
  '#2979FF', // blue
  '#00B894', // green-teal
  '#E040FB', // magenta
  '#FF9500', // orange
  '#7C4DFF', // violet
  '#00BCD4', // cyan
  '#FF2D8E', // pink
  '#5DD400', // lime
  '#F5A600', // amber
  '#448AFF', // light blue
  '#FF1744', // crimson
  '#00BFA5', // teal
  '#8E24AA', // purple
  '#FF6D00', // deep orange
  '#29A9E0', // sky
  '#00C853', // green
  '#F50057', // hot pink
  '#9575FF', // periwinkle
  '#D4A200', // gold
  '#FF7043', // coral
  '#52B812', // olive lime
]

const JLPT_ORDER  = ['N5', 'N4', 'N3', 'N2', 'N1'] as const
const JLPT_COLORS: Record<string, string> = {
  N5: '#4ade80',
  N4: '#22d3ee',
  N3: '#60a5fa',
  N2: '#a78bfa',
  N1: '#f87171',
}
// Only top-of-stack bar gets rounded corners
const JLPT_RADIUS: Record<string, [number, number, number, number]> = {
  N5: [0, 0, 0, 0],
  N4: [0, 0, 0, 0],
  N3: [0, 0, 0, 0],
  N2: [0, 0, 0, 0],
  N1: [6, 6, 0, 0],
}

const TOOLTIP_STYLE = {
  borderRadius: '12px',
  border: '1px solid #e5e7eb',
  fontSize: '12px',
  fontFamily: 'Poppins, sans-serif',
  boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
  padding: '10px 14px',
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface SummaryItem {
  name: string                        // display name ("Derek" or "Ryan G.")
  fullName: string                    // full name for the table
  avgScore: number
  avgTalk: number
  lessons: number
  totalVocab: number
  vocabByLevel: Record<string, number>
}

interface ClassStats {
  totalLessons: number
  avgScore: number
  avgTalk: number
  topStudent: string
  totalVocab: number
}

export interface ProgressionItem {
  name: string
  fullName: string
  points: { idx: number; lesson: number; score: number }[]
  avg: number
  delta: number
  lessons: number
}

interface Props {
  summaryData: SummaryItem[]
  progressionData: ProgressionItem[]
  classStats: ClassStats
  /** [min, max] fitted to the scores that exist, shared by every sparkline. */
  scoreDomain: [number, number]
}

// ── Vocab tooltip ─────────────────────────────────────────────────────────────

function VocabTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const total = payload.reduce((sum: number, p: any) => sum + (p.value ?? 0), 0)
  return (
    <div style={{ ...TOOLTIP_STYLE, background: '#fff' }}>
      <p className="font-semibold text-ink mb-2">{label}</p>
      {[...payload].reverse().map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2 py-0.5">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.fill }} />
          <span className="text-muted">{p.dataKey}</span>
          <span className="font-bold text-ink ml-auto pl-4">{p.value}</span>
        </div>
      ))}
      <div className="border-t border-gray-100 mt-1.5 pt-1.5 flex justify-between">
        <span className="text-muted">Total</span>
        <span className="font-bold text-ink">{total}</span>
      </div>
    </div>
  )
}

// ── Student progression card ──────────────────────────────────────────────────

function SparkTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div style={{ ...TOOLTIP_STYLE, background: '#fff', padding: '6px 10px' }}>
      <span className="text-muted">Lesson {p.lesson}</span>
      <span className="font-bold text-ink ml-2">{p.score}</span>
    </div>
  )
}

// The AI score wobbles by about 0.42 (SD) between lessons for the same student,
// so a first-to-last difference carries roughly 0.6 of noise on its own. Below
// that, a "change" is the scorer being inconsistent, not the student moving —
// flagging it red would send Noa chasing ghosts. 0.6 is one standard deviation
// of that difference, measured over all 125 published lessons.
const TREND_NOISE = 0.6

function trendOf(delta: number) {
  if (delta > TREND_NOISE) return { color: '#16a34a', arrow: '▲', label: 'up' }
  if (delta < -TREND_NOISE) return { color: '#dc2626', arrow: '▼', label: 'down' }
  return { color: '#9ca3af', arrow: '▬', label: 'steady' }
}

function ProgressionCard({ s, color, domain }: { s: ProgressionItem; color: string; domain: [number, number] }) {
  const t = trendOf(s.delta)
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-3.5 hover:border-gray-200 transition-colors">
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <span className="font-semibold text-ink text-sm truncate" title={s.fullName}>{s.name}</span>
        <span className="text-xs font-semibold tabular-nums shrink-0" style={{ color: t.color }}
          title={`${t.label} ${Math.abs(s.delta)} points from their first lesson to their last`}>
          {t.arrow} {Math.abs(s.delta).toFixed(1)}
        </span>
      </div>
      <div className="h-[52px] -mx-1">
        {s.lessons > 1 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={s.points} margin={{ top: 6, right: 8, bottom: 2, left: 8 }}>
              <YAxis domain={domain} hide />
              <ReferenceLine y={s.avg} stroke="#e5e7eb" strokeDasharray="3 3" />
              <Tooltip content={<SparkTooltip />} cursor={{ stroke: '#e5e7eb' }} />
              <Line type="monotone" dataKey="score" stroke={color} strokeWidth={2.4}
                dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff', fill: color }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center">
            <span className="text-[11px] text-muted italic">one lesson so far</span>
          </div>
        )}
      </div>
      <p className="text-[11px] text-muted mt-1">
        {s.lessons} lesson{s.lessons !== 1 ? 's' : ''} · avg <span className="font-semibold text-ink">{s.avg}</span>
      </p>
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ClassAnalyticsCharts({ summaryData, progressionData, classStats, scoreDomain }: Props) {
  // Colour is assigned once, by the student's rank in summaryData, and looked up
  // by name everywhere else. The progression grid sorts differently, so keying
  // off the array index there would have given the same student two colours.
  const colorOf = new Map(summaryData.map((s, i) => [s.name, STUDENT_COLORS[i % STUDENT_COLORS.length]]))
  const declining = progressionData.filter(s => s.delta < -TREND_NOISE).length
  // Flatten nested vocabByLevel for Recharts (can't use dot-notation in dataKey)
  const vocabChartData = summaryData.map(s => ({
    name: s.name,
    N5: s.vocabByLevel['N5'] ?? 0,
    N4: s.vocabByLevel['N4'] ?? 0,
    N3: s.vocabByLevel['N3'] ?? 0,
    N2: s.vocabByLevel['N2'] ?? 0,
    N1: s.vocabByLevel['N1'] ?? 0,
  }))
  const hasVocabData = summaryData.some(s => s.totalVocab > 0)

  return (
    <div className="space-y-6">

      {/* ── Class overview stat cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="stat-card">
          <span className="stat-label">Total Lessons</span>
          <span className="stat-value">{classStats.totalLessons}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Class Avg Score</span>
          <span className="stat-value" style={{ color: '#0a61c9' }}>
            {classStats.avgScore}<span className="text-sm font-medium text-muted">/10</span>
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Avg Talk Time</span>
          <span className="stat-value">
            {classStats.avgTalk}<span className="text-sm font-medium text-muted">%</span>
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Most Active</span>
          <span className="stat-value text-base leading-snug">{classStats.topStudent}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Total Vocab</span>
          <span className="stat-value" style={{ color: '#10b981' }}>{classStats.totalVocab.toLocaleString()}</span>
        </div>
      </div>

      {/* ── Average score bar chart ── */}
      <div className="card p-6">
        <h3 className="font-bold text-ink mb-0.5">Average Score by Student</h3>
        <p className="text-xs text-muted mb-5">Ranked highest to lowest across all published lessons</p>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={summaryData} margin={{ top: 8, right: 12, left: -20, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6b7280', fontFamily: 'Poppins' }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: '#f9fafb' }} formatter={(v: unknown) => [`${v}/10`, 'Avg Score']} />
            <ReferenceLine
              y={classStats.avgScore}
              stroke="#0a61c9" strokeDasharray="5 3" strokeOpacity={0.45}
              label={{ value: `class avg ${classStats.avgScore}`, position: 'insideTopRight', fontSize: 10, fill: '#0a61c9', dy: 4, dx: -4 }}
            />
            <Bar dataKey="avgScore" radius={[6, 6, 0, 0]} maxBarSize={54}>
              {summaryData.map((s, i) => <Cell key={i} fill={colorOf.get(s.name)} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Score progression, one card per student ── */}
      {progressionData.length > 0 && (
        <div className="card p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
            <div>
              <h3 className="font-bold text-ink mb-0.5">Score Progression</h3>
              <p className="text-xs text-muted">
                Each student&apos;s own lessons, biggest drop first. The arrow is the change from their
                first lesson to their last; the dashed line is their average. Hover a point for the lesson.
              </p>
            </div>
            {declining > 0 && (
              <span className="text-xs font-semibold text-red-600 bg-red-50 border border-red-100 rounded-full px-3 py-1 shrink-0">
                {declining} trending down
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {progressionData.map(s => (
              <ProgressionCard
                key={s.fullName}
                s={s}
                color={colorOf.get(s.name) ?? STUDENT_COLORS[0]}
                domain={scoreDomain}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Talk time bar chart ── */}
      <div className="card p-6">
        <h3 className="font-bold text-ink mb-0.5">Average Talk Time</h3>
        <p className="text-xs text-muted mb-5">How much each student speaks — target is ~50%</p>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={summaryData} margin={{ top: 8, right: 12, left: -10, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6b7280', fontFamily: 'Poppins' }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: '#f9fafb' }} formatter={(v: unknown) => [`${v}%`, 'Avg Talk Time']} />
            <ReferenceLine
              y={50} stroke="#10b981" strokeDasharray="5 3" strokeOpacity={0.6}
              label={{ value: '50% target', position: 'insideTopRight', fontSize: 10, fill: '#10b981', dy: 4, dx: -4 }}
            />
            <Bar dataKey="avgTalk" radius={[6, 6, 0, 0]} maxBarSize={54}>
              {summaryData.map((s, i) => <Cell key={i} fill={colorOf.get(s.name)} opacity={0.85} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Vocabulary by JLPT level stacked bar chart ── */}
      {hasVocabData && (
        <div className="card p-6">
          <h3 className="font-bold text-ink mb-0.5">Vocabulary Coverage by JLPT Level</h3>
          <p className="text-xs text-muted mb-5">
            Total vocabulary items detected per student, stacked by difficulty — N5 (beginner) at base, N1 (advanced) at top
          </p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={vocabChartData} margin={{ top: 8, right: 12, left: -10, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6b7280', fontFamily: 'Poppins' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <Tooltip content={<VocabTooltip />} cursor={{ fill: '#f9fafb' }} />
              <Legend
                wrapperStyle={{ fontSize: '12px', fontFamily: 'Poppins', paddingTop: '12px' }}
                iconType="circle" iconSize={8}
                formatter={(value) => `${value} (${value === 'N5' ? 'beginner' : value === 'N4' ? 'elementary' : value === 'N3' ? 'intermediate' : value === 'N2' ? 'upper-int.' : 'advanced'})`}
              />
              {JLPT_ORDER.map(level => (
                <Bar
                  key={level}
                  dataKey={level}
                  stackId="vocab"
                  fill={JLPT_COLORS[level]}
                  radius={JLPT_RADIUS[level]}
                  maxBarSize={54}
                  name={level}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Class summary table ── */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-bold text-ink">Class Summary</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="text-left px-6 py-3 text-xs font-semibold text-muted uppercase tracking-wide">Student</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wide">Lessons</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wide">Avg Score</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wide">Talk Time</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wide">Vocab Items</th>
            </tr>
          </thead>
          <tbody>
            {summaryData.map((s, i) => (
              <tr key={s.fullName} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60 transition-colors">
                <td className="px-6 py-3.5">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: colorOf.get(s.name) }} />
                    <span className="font-medium text-ink">{s.fullName}</span>
                  </div>
                </td>
                <td className="px-4 py-3.5 text-center text-muted">{s.lessons}</td>
                <td className="px-4 py-3.5 text-center">
                  <span className={`font-bold ${s.avgScore >= 8 ? 'text-green-600' : s.avgScore >= 6.5 ? 'text-indigo-600' : 'text-orange-500'}`}>
                    {s.avgScore}/10
                  </span>
                </td>
                <td className="px-4 py-3.5 text-center text-muted">{s.avgTalk}%</td>
                <td className="px-4 py-3.5 text-center">
                  {s.totalVocab > 0 ? (
                    <span className="font-semibold text-emerald-600">{s.totalVocab.toLocaleString()}</span>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  )
}
