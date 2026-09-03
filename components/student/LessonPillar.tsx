import Link from 'next/link'

export type PillarLesson = {
  id: string
  number: number
  title: string
  meta: string
  score: number | null
  tag: string
  /** One line on what the lesson covered, from the recap. */
  desc?: string
  /** Homework still open — shown in the foot when there is any. */
  openHomework?: number
}

/** The student's lessons, stacked newest first — Lesson Studio's pillar. */
export default function LessonPillar({ lessons }: { lessons: PillarLesson[] }) {
  if (lessons.length === 0) {
    return (
      <div className="k-empty">
        <strong style={{ color: 'var(--ink)' }}>No lessons yet</strong>
        <br />
        Your lessons will appear here once Noa publishes them.
      </div>
    )
  }

  return (
    <div className="k-pillar">
      {lessons.map((l) => (
        <Link key={l.id} href={`/student/lessons/${l.id}`} className="k-pillar-card">
          <span className="k-pillar-num">{l.tag}</span>
          <span className="k-pillar-title">{l.title}</span>
          {l.desc && <span className="k-pillar-desc">{l.desc}</span>}
          <span className="k-pillar-meta">
            {l.meta}
            {l.openHomework ? ` · ${l.openHomework} homework item${l.openHomework === 1 ? '' : 's'} open` : ''}
          </span>
          {l.score != null && (
            <span className="k-pillar-foot">
              <span className="k-hw-track"><i style={{ width: `${Math.round((l.score / 10) * 100)}%` }} /></span>
              <b>{l.score}/10</b>
            </span>
          )}
          <span className="k-pillar-go" aria-hidden>→</span>
        </Link>
      ))}
    </div>
  )
}
