export const JLPT_LEVELS = [
  { level: 'N5', label: 'N5', bar: '#4ade80', barText: '#14532d', badge: '#dcfce7', badgeText: '#166534' },
  { level: 'N4', label: 'N4', bar: '#22d3ee', barText: '#164e63', badge: '#cffafe', badgeText: '#155e75' },
  { level: 'N3', label: 'N3', bar: '#60a5fa', barText: '#1e3a8a', badge: '#dbeafe', badgeText: '#1e40af' },
  { level: 'N2', label: 'N2', bar: '#a78bfa', barText: '#3b0764', badge: '#ede9fe', badgeText: '#5b21b6' },
  { level: 'N1', label: 'N1', bar: '#f87171', barText: '#7f1d1d', badge: '#fee2e2', badgeText: '#991b1b' },
] as const

export const JLPT_COLORS: Record<string, string> = Object.fromEntries(
  JLPT_LEVELS.map(({ level, bar }) => [level, bar])
)

export const JLPT_LABELS: Record<string, string> = Object.fromEntries(
  JLPT_LEVELS.map(({ level, label }) => [level, label])
)
