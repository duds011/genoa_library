/** Easiest to hardest. Japanese lessons report JLPT, every other language CEFR. */
export const JLPT_LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1']
export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

/** Easiest to hardest as indigo warming into purple, so the whole bar reads as
 *  one brand ramp rather than a rainbow. */
export const JLPT_COLORS: Record<string, string> = {
  N5: '#4f46e5',
  N4: '#6366f1',
  N3: '#8b5cf6',
  N2: '#a855f7',
  N1: '#c026d3',
}

export const CEFR_COLORS: Record<string, string> = {
  A1: '#4f46e5', A2: '#6366f1', B1: '#8b5cf6', B2: '#a855f7', C1: '#c026d3', C2: '#db2777',
}

/** Whichever scale the recap actually used — assuming JLPT charts a French
 *  student as empty. */
export const levelScale = (distribution: Record<string, number>) =>
  CEFR_LEVELS.some((l) => (distribution[l] ?? 0) > 0) ? CEFR_LEVELS : JLPT_LEVELS

export const levelColor = (level: string) => JLPT_COLORS[level] ?? CEFR_COLORS[level] ?? 'var(--brand)'

export default function VocabLevelBreakdown({
  distribution,
  totalCount,
  plain = false,
}: {
  distribution: Record<string, number>
  totalCount: number
  /** Inside a card that already has a heading: drop the card chrome and the
   *  duplicate "Vocabulary 45" label, keep the bar and the level names. */
  plain?: boolean
}) {
  if (!totalCount) return null

  const levels = levelScale(distribution).map((level) => ({
    level,
    count: distribution[level] ?? 0,
    pct: totalCount ? ((distribution[level] ?? 0) / totalCount) * 100 : 0,
  })).filter((l) => l.count > 0)

  if (levels.length === 0) return null

  return (
    <div className={plain ? 'vocab-line plain' : 'vocab-line analytics-card'}>
      {!plain && (
        <span className="vocab-line-label">
          Vocabulary <strong>{totalCount}</strong>
        </span>
      )}
      <div className="vocab-line-bar" role="img" aria-label={`Vocabulary by level: ${levels.map((l) => `${l.level} ${l.count}`).join(', ')}`}>
        {levels.map((l) => (
          <div key={l.level} style={{ width: `${l.pct}%`, background: levelColor(l.level) }} title={`${l.level}: ${l.count}`} />
        ))}
      </div>
      <div className="vocab-line-chips">
        {levels.map((l) => (
          <span key={l.level} className="vocab-chip" style={{ color: levelColor(l.level) }}>
            <i style={{ background: levelColor(l.level) }} />{l.level} {l.count}
          </span>
        ))}
      </div>
    </div>
  )
}
