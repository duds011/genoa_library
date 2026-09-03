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
}

/** The student's lessons, stacked earliest first. `preview` is the branding
 *  studio's canvas, where nothing should navigate. */
export default function LessonPillar({ lessons, preview }: { lessons: PillarLesson[]; preview?: boolean }) {
  if (lessons.length === 0) {
    return (
      <div className="k-empty">
        <strong style={{ color: 'var(--ink)' }}>No lessons yet</strong>
        <br />
        Your lessons will appear here once your teacher publishes them.
      </div>
    )
  }

  return (
    <div className="k-pillar">
      {lessons.map((l) => {
        const body = (
          <>
            <span className="k-pillar-num">{l.tag}</span>
            <span className="k-pillar-title">{l.title}</span>
            {l.desc && <span className="k-pillar-desc">{l.desc}</span>}
            <span className="k-pillar-meta">{l.meta}</span>
            {l.score != null && (
              <span className="k-pillar-foot">
                <span className="k-hw-track"><i style={{ width: `${Math.round((l.score / 10) * 100)}%` }} /></span>
                <b>{l.score}/10</b>
              </span>
            )}
            <span className="k-pillar-go" aria-hidden>→</span>
          </>
        )
        return preview ? (
          <div key={l.id} className="k-pillar-card">{body}</div>
        ) : (
          <Link key={l.id} href={`/student/lessons/${l.id}`} className="k-pillar-card">{body}</Link>
        )
      })}
    </div>
  )
}
