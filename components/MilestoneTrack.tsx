import { getLevelLabel } from '@/lib/utils'

export const MILESTONES = [1, 5, 10, 25, 50]
export const MILESTONE_EMOJIS = ['🌱', '🌸', '🌿', '⭐', '🏆']

/**
 * The milestone ladder in Lesson Studio's segmented shape: one segment per
 * rung, filling left to right, with this portal's badges underneath.
 */
export default function MilestoneTrack({ lessonCount, compact = false }: { lessonCount: number; compact?: boolean }) {
  const next = MILESTONES.find((m) => m > lessonCount) ?? null
  return (
    <div className="k-track">
      <div className="k-track-bar">
        {MILESTONES.map((m, i) => {
          const from = i === 0 ? 0 : MILESTONES[i - 1]
          const span = Math.max(1, m - from)
          const fill = Math.max(0, Math.min(100, ((lessonCount - from) / span) * 100))
          return (
            <span key={m} className="k-track-seg">
              <i style={{ width: `${fill}%`, background: 'var(--forest)' }} />
            </span>
          )
        })}
      </div>
      {!compact && (
        <div className="g-rungs">
          {MILESTONES.map((m, i) => (
            <span key={m} className={`g-rung ${lessonCount >= m ? 'on' : ''}`}>
              <i>{MILESTONE_EMOJIS[i]}</i>
              <b>{m}</b>
              <small>{getLevelLabel(m)}</small>
            </span>
          ))}
        </div>
      )}
      <p className="k-course-meta" style={{ marginTop: 10 }}>
        {next
          ? `${lessonCount} lesson${lessonCount === 1 ? '' : 's'} in · ${next - lessonCount} more to ${MILESTONE_EMOJIS[MILESTONES.indexOf(next)]} ${getLevelLabel(next)}`
          : `Every milestone cleared — ${lessonCount} lessons in.`}
      </p>
    </div>
  )
}
