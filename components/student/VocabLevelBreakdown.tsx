const JLPT_LEVELS = [
  { level: 'N5', label: 'Beginner',           color: '#06b6d4' },
  { level: 'N4', label: 'Elementary',          color: '#38bdf8' },
  { level: 'N3', label: 'Intermediate',        color: '#818cf8' },
  { level: 'N2', label: 'Upper-Intermediate',  color: '#a78bfa' },
  { level: 'N1', label: 'Advanced',            color: '#7c3aed' },
]

export const JLPT_COLORS: Record<string, string> = Object.fromEntries(
  JLPT_LEVELS.map(({ level, color }) => [level, color])
)

interface Props {
  vocab: { jlpt_level?: string | null }[]
}

export default function VocabLevelBreakdown({ vocab }: Props) {
  const total = vocab.length
  if (total === 0) return null

  const counts = JLPT_LEVELS.map(def => ({
    ...def,
    count: vocab.filter(v => v.jlpt_level === def.level).length,
  })).filter(c => c.count > 0)

  if (counts.length === 0) return null

  return (
    <div className="card p-5">
      <h2 className="text-xs font-bold text-muted uppercase tracking-widest mb-3">
        Vocabulary Level (JLPT)
      </h2>

      {/* Segmented bar */}
      <div className="flex rounded-full h-9 overflow-hidden mb-3">
        {counts.map(({ level, color, count }) => (
          <div
            key={level}
            className="flex items-center justify-center gap-1 text-white text-xs font-bold transition-all"
            style={{
              width: `${(count / total) * 100}%`,
              background: color,
              minWidth: '44px',
            }}
          >
            <span>{level}</span>
            <span>{count}</span>
          </div>
        ))}
      </div>

      {/* Badge legend */}
      <div className="flex flex-wrap gap-2">
        {counts.map(({ level, label, color, count }) => (
          <span
            key={level}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
            style={{
              background: color + '18',
              color,
              border: `1px solid ${color}35`,
            }}
          >
            <strong>{level} {count}</strong>
            <span className="font-normal opacity-70">{label}</span>
          </span>
        ))}
      </div>
    </div>
  )
}
