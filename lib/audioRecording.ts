/**
 * One place that answers "what can this browser actually record, and what did
 * we just record?".
 *
 * The bug this exists to prevent: Safari — on iPhone and on the Mac — cannot
 * record WebM. It hands back MP4/AAC. Code that assumed WebM wrapped those
 * bytes in a Blob typed `audio/webm`, named the file `.webm`, and uploaded it,
 * so Supabase then served MP4 audio under `Content-Type: audio/webm`. Safari
 * has no WebM decoder, so it refused to play the clip back — the recording was
 * perfectly fine, the label was a lie. Twenty-seven files in `student-audio`
 * were stored that way before this was fixed.
 *
 * The rule: never name a format, always ask the recorder what it made.
 */

const CANDIDATES = ['audio/webm', 'audio/mp4', 'audio/ogg']

/** The first container this browser will actually record, or '' to let it choose. */
export function pickRecordingType(): string {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return ''
  for (const t of CANDIDATES) {
    if (MediaRecorder.isTypeSupported(t)) return t
  }
  return ''
}

/** File extension matching a MIME type, so the name never contradicts the bytes. */
export function extForType(type: string): string {
  if (type.includes('mp4') || type.includes('m4a') || type.includes('aac')) return 'm4a'
  if (type.includes('ogg')) return 'ogg'
  if (type.includes('mpeg')) return 'mp3'
  if (type.includes('wav')) return 'wav'
  return 'webm'
}

/** Start a microphone recorder in whatever format this browser supports. */
export function newRecorder(stream: MediaStream): MediaRecorder {
  const mime = pickRecordingType()
  return new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
}

/**
 * Turn the collected chunks into a file whose type, extension and content all
 * agree. Returns null when nothing was captured — a stop that arrives before
 * the first chunk leaves an empty blob, and uploading that produced the 0-byte
 * clip sitting in storage today.
 */
export function fileFromChunks(
  chunks: Blob[],
  recorder: MediaRecorder | null,
  baseName: string,
): File | null {
  const type = recorder?.mimeType || pickRecordingType() || 'audio/webm'
  const blob = new Blob(chunks, { type })
  if (blob.size === 0) return null
  return new File([blob], `${baseName}.${extForType(type)}`, { type })
}

/**
 * A recording's own type, for the storage upload. supabase-js defaults to the
 * File's type, but an uploaded file picked off disk can arrive with an empty
 * one, and then the object is stored as octet-stream and no browser will play
 * it. Fall back to the extension in that case.
 */
export function contentTypeFor(file: File): string {
  if (file.type) return file.type
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext === 'm4a' || ext === 'mp4') return 'audio/mp4'
  if (ext === 'mp3') return 'audio/mpeg'
  if (ext === 'ogg') return 'audio/ogg'
  if (ext === 'wav') return 'audio/wav'
  return 'audio/webm'
}
