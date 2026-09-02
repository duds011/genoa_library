/**
 * Where extension recordings live. Kept out of the route files because a
 * Next.js route module may only export handlers and its config.
 */
export const RECORDING_BUCKET = 'lesson-recordings'

export const trackPath = (recordingId: string, track: string) => `${recordingId}/${track}.webm`

/**
 * Where the words go once we have paid to hear them.
 *
 * Transcription is billed per minute of audio and is roughly 85% of what a
 * recap costs, so rebuilding one from the audio again is the same bill twice
 * for a result that cannot differ. This sits inside the recording's own folder
 * on purpose: the daily purge walks that folder and removes anything past the
 * retention window, so the transcript expires alongside the audio it came from
 * without the purge needing to know it exists.
 */
export const transcriptPath = (recordingId: string) => `${recordingId}/transcript.json`

/** What transcriptPath holds. Versioned so the shape can change safely. */
export type CachedTranscript = {
  v: 1
  /** The code the transcriber was told, so a cache built under the wrong one is visible. */
  language: string | null
  createdAt: string
  /** Keyed by track, NOT by speaker — who held the mic is decided at rebuild time. */
  tracks: Record<string, { text: string; start: number; end: number }[]>
}

/**
 * How long uploaded lesson audio is kept before the daily purge removes it.
 *
 * Stated as a promise in the privacy policy and in the extension's first-run
 * disclosure, so it is not a number to change casually — both say 30 days.
 * Long enough that /api/recap/build can still rebuild a recap from the
 * original audio, short enough to be a real limit rather than "indefinitely".
 */
export const RETENTION_DAYS = 30
