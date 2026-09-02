/**
 * PORTED FROM LESSON STUDIO — koku-library.app, lib/lesson-limits.ts
 *
 * The recap engine this portal now runs on. It was written for Lesson Studio
 * and copied here rather than shared, because the two apps are separate
 * products on separate databases and neither should be able to take the other
 * down. The cost of that choice is this: these files exist twice, and a fix
 * made in one is not a fix in the other. Change them in step.
 */

/**
 * How long a lesson is allowed to be.
 *
 * Transcription is billed per minute of audio, and every lesson is recorded as
 * two tracks — mic and tab, each the full length of the call. One minute of
 * teaching is therefore two minutes on the invoice. A recorder left running
 * after everyone has said goodbye is not an untidy file, it is a bill that
 * grows on its own, and the teacher who forgot is the last person who would
 * ever notice.
 *
 * 55 minutes covers a scheduled hour with the goodbyes inside it. The Chrome
 * extension stops itself there; these limits exist because the version already
 * published to the Web Store does not, and because `seconds` arrives from a
 * client and is a claim rather than a measurement.
 */
export const MAX_LESSON_SECONDS = 55 * 60

/** For the message a teacher actually reads. */
export const MAX_LESSON_MINUTES = MAX_LESSON_SECONDS / 60

/**
 * The same ceiling expressed in bytes, per track — the last line of defence,
 * and the only one measured on the audio itself rather than reported about it.
 *
 * At the recorder's 32kbps mono a 55-minute track is ~13.2MB (a real one came
 * in at 10MB for 49 minutes). The allowance above that absorbs container
 * overhead and any drift in the encoder's actual rate, while still refusing the
 * runaway 90-minute recording this exists to stop.
 */
export const MAX_TRACK_BYTES = 15 * 1024 * 1024

/**
 * Whether a client-reported duration is over the line.
 *
 * A minute of grace: the recorder clamps its own clock to the ceiling, so
 * anything meaningfully above it is an older extension or a bad number, but
 * rounding at the boundary should not cost someone their lesson.
 */
export function overLessonLimit(seconds: unknown): boolean {
  const n = Number(seconds)
  return Number.isFinite(n) && n > MAX_LESSON_SECONDS + 60
}

/** One wording, so the teacher reads the same sentence wherever it is refused. */
export const TOO_LONG_MESSAGE =
  'This recording is too long to process. Update the Koku Recorder extension — ' +
  'the current version wraps up long lessons and sends them for you.'
