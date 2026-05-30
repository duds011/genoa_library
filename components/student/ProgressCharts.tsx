'use client'

import {
  ComposedChart, Bar, Line, BarChart,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'

interface ChartLesson {
  lessonNumber: number
  score: number | null
  talkPct: number | null
  vocabCount: number
}

interface Props {
  lessons: ChartLesson[] // descending order — we reverse for charts
}

const BRAND  = '#4f46e5'
const PURPLE = '#7c3aed'

function CustomTooltip({ active, payload, label, suffix = '', label2 = '' }: any) {
  if (!active || !payload?.length) return null
  const val = payload.find((p: any) => p.type === 'bar')?.value ?? payload[0]?.value
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-3 py-2 text-xs">
      <p className="text-muted mb-1 font-semibold">Lesson {label}</p>
      <p className="text-ink font-bold">{val}{suffix} {label2}</p>
    </div>
  )
}

export default function ProgressCharts({ lessons }: Props) {
  if (lessons.length < 2) return null

  // Chronological order for charts
  const data = [...lessons].reverse()

  // Cumulative vocabulary
  let running = 0
  const vocabData = data.map(l => {
    running += l.vocabCount
    return { lessonNumber: l.lessonNumber, cumVocab: running, newWords: l.vocabCount }
  })

  const hasScores = data.some(l => l.score !== null)
  const hasTalk   = data.some(l => l.talkPct !== null)

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-bold text-ink uppercase tracking-wide">Progress Charts</h2>

      <div className="grid sm:grid-cols-2 gap-4">
        {/* ── Score over time ─────────────────────────────────── */}
        {hasScores && (
          <div className="card p-5">
            <p className="text-xs font-bold text-muted uppercase tracking-widest mb-4">📈 Score Progress</p>
            <ResponsiveContainer width="100%" height={160}>
              <ComposedChart data={data} margin={{ top: 4, right: 4, left: -22, bottom: 0 }} barSize={22}>
                <defs>
                  <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={BRAND} stopOpacity={0.55} />
                    <stop offset="100%" stopColor={BRAND} stopOpacity={0.12} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis
                  dataKey="lessonNumber"
                  tick={{ fontSize: 10, fill: '#9ca3af' }}
                  tickFormatter={n => `L${n}`}
                  axisLine={false} tickLine={false}
                />
                <YAxis
                  domain={[0, 10]} ticks={[0, 5, 10]}
                  tick={{ fontSize: 10, fill: '#9ca3af' }}
                  axisLine={false} tickLine={false}
                />
                <ReferenceLine y={7} stroke="#e0e7ff" strokeDasharray="4 3" />
                <Tooltip content={<CustomTooltip suffix="/10" label2="score" />} />
                <Bar
                  dataKey="score"
                  fill="url(#sg)"
                  radius={[4, 4, 0, 0]}
                  stroke={BRAND}
                  strokeWidth={0}
                />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke={BRAND}
                  strokeWidth={2}
                  dot={{ fill: BRAND, r: 3, strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 5, fill: BRAND, stroke: '#fff', strokeWidth: 2 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* ── Talk time ───────────────────────────────────────── */}
        {hasTalk && (
          <div className="card p-5">
            <p className="text-xs font-bold text-muted uppercase tracking-widest mb-4">🗣️ Your Talk Time</p>
            <ResponsiveContainer width="100%" height={160}>
              <ComposedChart data={data} margin={{ top: 4, right: 4, left: -22, bottom: 0 }} barSize={22}>
                <defs>
                  <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={PURPLE} stopOpacity={0.55} />
                    <stop offset="100%" stopColor={PURPLE} stopOpacity={0.12} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis
                  dataKey="lessonNumber"
                  tick={{ fontSize: 10, fill: '#9ca3af' }}
                  tickFormatter={n => `L${n}`}
                  axisLine={false} tickLine={false}
                />
                <YAxis
                  domain={[0, 100]} ticks={[0, 50, 100]}
                  tick={{ fontSize: 10, fill: '#9ca3af' }}
                  tickFormatter={v => `${v}%`}
                  axisLine={false} tickLine={false}
                />
                <ReferenceLine y={50} stroke="#ede9fe" strokeDasharray="4 3" />
                <Tooltip content={<CustomTooltip suffix="%" label2="talk time" />} />
                <Bar
                  dataKey="talkPct"
                  fill="url(#tg)"
                  radius={[4, 4, 0, 0]}
                  stroke={PURPLE}
                  strokeWidth={0}
                />
                <Line
                  type="monotone"
                  dataKey="talkPct"
                  stroke={PURPLE}
                  strokeWidth={2}
                  dot={{ fill: PURPLE, r: 3, strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 5, fill: PURPLE, stroke: '#fff', strokeWidth: 2 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ── Vocabulary growth ─────────────────────────────────── */}
      <div className="card p-5">
        <p className="text-xs font-bold text-muted uppercase tracking-widest mb-4">📖 Vocabulary Growth</p>
        <ResponsiveContainer width="100%" height={130}>
          <BarChart data={vocabData} margin={{ top: 4, right: 4, left: -22, bottom: 0 }} barSize={20}>
            <defs>
              <linearGradient id="vg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={BRAND}  stopOpacity={1} />
                <stop offset="100%" stopColor={PURPLE} stopOpacity={0.7} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis
              dataKey="lessonNumber"
              tick={{ fontSize: 10, fill: '#9ca3af' }}
              tickFormatter={n => `L${n}`}
              axisLine={false} tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#9ca3af' }}
              axisLine={false} tickLine={false}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null
                return (
                  <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-3 py-2 text-xs">
                    <p className="text-muted mb-1 font-semibold">Lesson {label}</p>
                    <p className="text-ink font-bold">{payload[0].value} total words</p>
                    <p className="text-muted">+{payload[0].payload.newWords} this lesson</p>
                  </div>
                )
              }}
            />
            <Bar dataKey="cumVocab" fill="url(#vg)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
