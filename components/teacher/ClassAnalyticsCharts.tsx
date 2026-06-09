'use client'

import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts'

// ── Colour palettes ──────────────────────────────────────────────────────────

const STUDENT_COLORS = [
  '#4f46e5', '#7c3aed', '#06b6d4', '#10b981',
  '#f59e0b', '#f43f5e', '#8b5cf6', '#ec4899', '#14b8a6',
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

interface Props {
  summaryData: SummaryItem[]
  trendData: Record<string, number>[]
  studentNames: string[]
  classStats: ClassStats
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

// ── Component ─────────────────────────────────────────────────────────────────

export default function ClassAnalyticsCharts({ summaryData, trendData, studentNames, classStats }: Props) {
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
          <span className="stat-value" style={{ color: '#4f46e5' }}>
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
              stroke="#4f46e5" strokeDasharray="5 3" strokeOpacity={0.45}
              label={{ value: `class avg ${classStats.avgScore}`, position: 'insideTopRight', fontSize: 10, fill: '#4f46e5', dy: 4, dx: -4 }}
            />
            <Bar dataKey="avgScore" radius={[6, 6, 0, 0]} maxBarSize={54}>
              {summaryData.map((_, i) => <Cell key={i} fill={STUDENT_COLORS[i % STUDENT_COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Score progression line chart ── */}
      {trendData.length > 1 && (
        <div className="card p-6">
          <h3 className="font-bold text-ink mb-0.5">Score Progression</h3>
          <p className="text-xs text-muted mb-5">Each student's score per lesson number over time</p>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trendData} margin={{ top: 8, right: 20, left: -20, bottom: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="lesson" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false}
                label={{ value: 'Lesson number', position: 'insideBottom', offset: -12, fontSize: 11, fill: '#9ca3af' }} />
              <YAxis domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: unknown, name: unknown) => [`${v}/10`, String(name ?? '')]} />
              <Legend wrapperStyle={{ fontSize: '12px', fontFamily: 'Poppins', paddingTop: '12px' }} iconType="circle" iconSize={8} />
              {studentNames.map((name, i) => (
                <Line key={name} type="monotone" dataKey={name}
                  stroke={STUDENT_COLORS[i % STUDENT_COLORS.length]} strokeWidth={2.5}
                  dot={{ r: 4, strokeWidth: 0, fill: STUDENT_COLORS[i % STUDENT_COLORS.length] }}
                  activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }}
                  connectNulls={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
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
              {summaryData.map((_, i) => <Cell key={i} fill={STUDENT_COLORS[i % STUDENT_COLORS.length]} opacity={0.85} />)}
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
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: STUDENT_COLORS[i % STUDENT_COLORS.length] }} />
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
