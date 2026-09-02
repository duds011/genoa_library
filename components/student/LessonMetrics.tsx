/**
 * How the student actually spoke, measured.
 *
 * None of this was possible before. The old pipeline read a Google Meet
 * transcript — one undifferentiated stream with no word timings — so talk-time
 * was an estimate and everything here was simply unavailable. The recorder
 * captures the teacher's microphone and the student's tab as separate tracks
 * with per-word timings, so these are counted rather than guessed.
 *
 * Rendered only when a lesson has them, which means only for lessons recorded
 * with the extension. Every earlier lesson keeps its page exactly as it was.
 */

export type LessonMetricsShape = {
  studentWpm?: number | null
  avgResponseSec?: number | null
  fillerCount?: number | null
  longPauseCount?: number | null
  studentTurns?: number | null
  avgTurnWords?: number | null
  longestTurnSec?: number | null
  lessonVocab?: number | null
  studentVocab?: number | null
}

type Tile = {
  value: string
  label: string
  hint: string
}

const dash = (v: unknown, suffix = '', decimals = 0): string =>
  typeof v === 'number' && Number.isFinite(v)
    ? `${decimals ? v.toFixed(decimals) : Math.round(v)}${suffix}`
    : '—'

export default function LessonMetrics({
  metrics,
  studentFirst,
}: {
  metrics: LessonMetricsShape | null | undefined
  studentFirst: string
}) {
  if (!metrics) return null

  const tiles: Tile[] = [
    { value: dash(metrics.studentWpm), label: 'words / min', hint: 'your speaking pace' },
    { value: dash(metrics.avgResponseSec, 's', 1), label: 'thinking time', hint: 'before you answered' },
    { value: dash(metrics.longestTurnSec, 's'), label: 'longest answer', hint: 'best unbroken stretch' },
    { value: dash(metrics.avgTurnWords), label: 'words / answer', hint: 'average turn length' },
    { value: dash(metrics.fillerCount), label: 'hesitations', hint: 'えーと, あの, um…' },
    { value: dash(metrics.longPauseCount), label: 'long pauses', hint: 'silences over 1.5s' },
  ]

  // A tile row of nothing but em dashes says less than no row at all.
  if (!tiles.some((t) => t.value !== '—')) return null

  return (
    <div className="gr-metrics">
      <p className="gr-sublab">{studentFirst}&rsquo;s speaking, measured</p>
      <div className="gr-metric-grid">
        {tiles.map((t) => (
          <div key={t.label} className="gr-metric">
            <span className="gr-metric-v">{t.value}</span>
            <span className="gr-metric-k">{t.label}</span>
            <span className="gr-metric-h">{t.hint}</span>
          </div>
        ))}
      </div>
      {typeof metrics.studentVocab === 'number' && typeof metrics.lessonVocab === 'number' && (
        <p className="gr-metric-foot">
          You used <b>{metrics.studentVocab}</b> different words of the{' '}
          <b>{metrics.lessonVocab}</b> that came up in the lesson.
        </p>
      )}
    </div>
  )
}
