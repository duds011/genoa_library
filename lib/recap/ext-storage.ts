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
 * **0 means keep it — the purge does nothing and no audio is ever deleted.**
 *
 * It was 30. Noa asked for the recordings to be kept (2026-09-09): a lesson is
 * worth going back to long after a month, and rebuilding a recap needs the
 * original audio. Whatever this says has to match what the privacy policy and
 * the extension's first-run disclosure tell students, so change all three
 * together or the portal is misrepresenting what it does.
 */
export const RETENTION_DAYS = 0
