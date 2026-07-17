import { JLPT_LEVELS } from '@/lib/jlpt'

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
      <div className="card p-4">
        <h2 className="text-[11px] font-bold text-muted uppercase tracking-widest mb-1.5">
          Vocabulary Profile
        </h2>
        <p className="text-sm text-muted">No vocabulary items detected for this lesson.</p>
      </div>
    )
  }

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-[11px] font-bold text-muted uppercase tracking-widest">
          Vocabulary Profile
        </h2>
        <span className="text-xs text-muted font-medium">
          {displayTotal}{isPartial ? '+' : ''} vocabulary items covered
        </span>
      </div>

      {/* Segmented bar */}
      <div className="flex rounded-xl overflow-hidden mb-2" style={{ height: '22px' }}>
        {counts.map(({ level, bar, barText, count }) => (
          <div
            key={level}
            className="flex items-center justify-center text-[11px] font-bold transition-all overflow-hidden"
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
      <div className="flex flex-wrap gap-1.5">
        {counts.map(({ level, label, badge, badgeText, count }) => (
          <span
            key={level}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
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
