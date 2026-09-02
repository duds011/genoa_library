/**
 * PORTED FROM LESSON STUDIO — koku-library.app, lib/cutmap.ts
 *
 * The recap engine this portal now runs on. It was written for Lesson Studio
 * and copied here rather than shared, because the two apps are separate
 * products on separate databases and neither should be able to take the other
 * down. The cost of that choice is this: these files exist twice, and a fix
 * made in one is not a fix in the other. Change them in step.
 */

/**
 * Silence-stripped recordings arrive in COMPRESSED time: the recorder pauses
 * while nobody speaks, so a word at second 300 of the file may have been said
 * at minute 12 of the lesson. The extension records a map of resume points —
 * { rec, real } pairs in seconds — and this shifts every transcribed word
 * back onto the real lesson clock, so the two tracks interleave correctly
 * and talk-time still means what it says.
 *
 * A missing or malformed map is the identity: recordings from extensions
 * that don't strip (or where stripping failed open) pass through untouched.
 */
export type CutMapPoint = { rec: number; real: number }

export function toRealTime<T extends { start: number; end: number }>(
  words: T[],
  map?: CutMapPoint[] | null,
): T[] {
  if (!Array.isArray(map) || map.length === 0) return words
  const pts = map
    .filter((p) => p && Number.isFinite(p.rec) && Number.isFinite(p.real) && p.real >= p.rec)
    .sort((a, b) => a.rec - b.rec)
  if (!pts.length) return words
  if (pts[0].rec > 0) pts.unshift({ rec: 0, real: 0 })

  const shift = (t: number) => {
    let p = pts[0]
    for (const q of pts) {
      if (q.rec <= t) p = q
      else break
    }
    return Math.max(0, t - p.rec + p.real)
  }
  return words.map((w) => ({ ...w, start: shift(w.start), end: shift(w.end) }))
}
