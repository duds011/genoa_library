/**
 * PORTED FROM LESSON STUDIO — koku-library.app, lib/lesson-note.ts
 *
 * The one-line record of a lesson, for the teacher's own Notes grid.
 */

const TOPICS = 3
const TOPIC_MAX = 42

const clean = (v: unknown): string => String(v ?? '').replace(/\s+/g, ' ').trim()
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s)

/**
 * What was taught, in the two lines a month grid can hold.
 *
 * Her Notes tab answers "where did we leave off?" at a glance, across a whole
 * month of students. That question is answered by the lesson's title and the
 * names of its parts, not by prose — so this is a heading and a topic list,
 * deliberately not a summary. The recap itself is one click away.
 *
 * Section titles arrive numbered ("1. Activity: Particle Usage"), which is
 * useful in the recap and noise in a grid cell, so the numbering goes.
 */
export function noteFromLesson(
  title: string | null | undefined,
  sectionTitles: (string | null | undefined)[],
): string {
  const head = clean(title)
  const topics = sectionTitles
    .map((t) => clean(t).replace(/^\d+\.\s*/, ''))
    .filter(Boolean)
    .slice(0, TOPICS)
    .map((t) => clip(t, TOPIC_MAX))

  const lines: string[] = []
  if (head) lines.push(clip(head, 80))
  // Skipped when the only topic would restate the title, which is exactly what
  // a one-section lesson produces.
  if (topics.length && !(topics.length === 1 && topics[0] === head)) {
    lines.push(topics.join(' · '))
  }
  return lines.join('\n')
}
