/**
 * Which recap design a lesson gets.
 *
 * The rule is the one Noa asked for: every lesson already taught keeps the
 * page its student has been reading all along, and everything from here on
 * gets the new one. So the line is drawn in TIME, not in the pipeline — she
 * teaches on Google Meet as well as through the recorder, and a lesson should
 * not look different because of which one carried it.
 *
 * Anything carrying a `source` is new by construction: the column did not
 * exist until the recorder did, so nothing taught the old way has one.
 */

/**
 * Lessons created from this instant on use the new recap.
 *
 * Set to the moment the redesign went live. Moving it earlier would restyle
 * lessons students have already read, which is the one thing this file exists
 * to prevent — so treat it as a fact about the past, not a setting.
 */
export const NEW_RECAP_FROM = Date.parse('2026-09-03T00:00:00Z')

export function usesNewRecap(lesson: { source?: string | null; created_at?: string | null }): boolean {
  if (lesson.source) return true
  const created = lesson.created_at ? Date.parse(lesson.created_at) : NaN
  // A row with no readable created_at is older than the column's use here;
  // fall back to the design that was already correct for it.
  return Number.isFinite(created) && created >= NEW_RECAP_FROM
}
