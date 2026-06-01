const JLPT_LEVELS = [
  { level: 'N5', label: 'Foundation',   bar: '#4ade80', barText: '#14532d', badge: '#dcfce7', badgeText: '#166534' },
  { level: 'N4', label: 'Elementary',   bar: '#22d3ee', barText: '#164e63', badge: '#cffafe', badgeText: '#155e75' },
  { level: 'N3', label: 'Intermediate', bar: '#60a5fa', barText: '#1e3a8a', badge: '#dbeafe', badgeText: '#1e40af' },
  { level: 'N2', label: 'Advanced',     bar: '#a78bfa', barText: '#3b0764', badge: '#ede9fe', badgeText: '#5b21b6' },
  { level: 'N1', label: 'Expert',       bar: '#f87171', barText: '#7f1d1d', badge: '#fee2e2', badgeText: '#991b1b' },
]

export const JLPT_COLORS: Record<string, string> = Object.fromEntries(
  JLPT_LEVELS.map(({ level, bar }) => [level, bar])
)

export const JLPT_LABELS: Record<string, string> = Object.fromEntries(
  JLPT_LEVELS.map(({ level, label }) => [level, label])
)

interface Props {
  vocab?: { jlpt_level?: string | null }[]
  distribution?: Record<string, number> | null
  totalCount?: number | null
  isPartial?: boolean
}

export default function VocabLevelBreakdown({
  vocab = [],
  distribution,
  totalCount,
  isPartial = false,
}: Props) {
  const counts = JLPT_LEVELS.map(def => ({
    ...def,
    count: distribution
      ? (distribution[def.level] ?? 0)
      : vocab.filter(v => v.jlpt_level === def.level).length,
  })).filter(c => c.count > 0)

  const labeled = counts.reduce((sum, c) => sum + c.count, 0)
  const displayTotal = totalCount ?? (distribution ? labeled : vocab.length)

  if (labeled === 0) {
    return (
      <div className="card p-5">
        <h2 className="text-xs font-bold text-muted uppercase tracking-widest mb-2">
          Vocabulary Profile
        </h2>
        <p className="text-sm text-muted">No vocabulary items detected for this lesson.</p>
      </div>
    )
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-bold text-muted uppercase tracking-widest">
          Vocabulary Profile
        </h2>
        <span className="text-xs text-muted font-medium">
          {displayTotal}{isPartial ? '+' : ''} vocabulary items covered
        </span>
      </div>

      {/* Segmented bar */}
      <div className="flex rounded-xl overflow-hidden mb-3" style={{ height: '30px' }}>
        {counts.map(({ level, bar, barText, count }) => (
          <div
            key={level}
            className="flex items-center justify-center text-xs font-bold transition-all overflow-hidden"
            style={{
              width: `${(count / labeled) * 100}%`,
              background: bar,
              color: barText,
              minWidth: 0,
              padding: '0 0.35rem',
              whiteSpace: 'nowrap',
            }}
          >
            {(count / labeled) * 100 >= 9 ? `${count}` : ''}
          </div>
        ))}
      </div>

      {/* Badge legend */}
      <div className="flex flex-wrap gap-2">
        {counts.map(({ level, label, badge, badgeText, count }) => (
          <span
            key={level}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
            style={{ background: badge, color: badgeText }}
          >
            <strong>{count}</strong>
            <span className="font-normal opacity-75">{label}</span>
          </span>
        ))}
      </div>
    </div>
  )
}
