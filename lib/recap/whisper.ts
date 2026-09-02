/**
 * PORTED FROM LESSON STUDIO — koku-library.app, lib/whisper.ts
 *
 * The recap engine this portal now runs on. It was written for Lesson Studio
 * and copied here rather than shared, because the two apps are separate
 * products on separate databases and neither should be able to take the other
 * down. The cost of that choice is this: these files exist twice, and a fix
 * made in one is not a fix in the other. Change them in step.
 */

/**
 * Transcribes the browser-extension recorder's tracks.
 *
 * The extension records each speaker on their own track, so there is no
 * diarization to do and no guessing: every word on the mic track is the person
 * holding the mic, every word on the tab track is the other participant. That
 * is strictly better attribution than a bot gets from one mixed stream.
 *
 * Output matches the segment shape lib/recall.ts already normalizes, so talk
 * time and the fluency metrics are computed by exactly the same code.
 */

import { MAX_TRACK_BYTES, MAX_LESSON_MINUTES } from './lesson-limits'
import { postMultipart, type Part } from './long-post'

/** A silence this long inside one speaker's audio starts a new turn. */
const TURN_GAP_SEC = 0.9

export type TrackInput = {
  blob: Blob
  /** Display name for this speaker in the transcript. */
  speaker: string
  /** The teacher is the host; talk-time percentages are measured against it. */
  isHost: boolean
}

type Word = { text: string; start: number; end: number }

/**
 * Whisper wants an ISO-639-1 code, the app stores a language name.
 *
 * Worth translating rather than skipping: left to auto-detect, Whisper decides
 * per track, and on a quiet or noisy one it guesses wrong and then invents
 * fluent text in that language — the exact failure keepConfidentWords exists to
 * clean up after. Telling it the language removes most of the opportunity.
 */
const ISO: Record<string, string> = {
  // The seven the app shipped with.
  english: 'en', french: 'fr', japanese: 'ja',
  spanish: 'es', german: 'de', italian: 'it', portuguese: 'pt',

  // Everything else Whisper handles well that someone might plausibly teach.
  // Missing entries used to fall through to undefined, which is exactly the
  // auto-detect guessing this map exists to prevent.
  arabic: 'ar', bengali: 'bn', bulgarian: 'bg', catalan: 'ca', chinese: 'zh',
  croatian: 'hr', czech: 'cs', danish: 'da', dutch: 'nl', estonian: 'et',
  filipino: 'tl', finnish: 'fi', greek: 'el', hebrew: 'he', hindi: 'hi',
  hungarian: 'hu', icelandic: 'is', indonesian: 'id', korean: 'ko',
  latvian: 'lv', lithuanian: 'lt', malay: 'ms', norwegian: 'no', persian: 'fa',
  polish: 'pl', romanian: 'ro', russian: 'ru', serbian: 'sr', slovak: 'sk',
  slovenian: 'sl', swahili: 'sw', swedish: 'sv', tamil: 'ta', thai: 'th',
  turkish: 'tr', ukrainian: 'uk', urdu: 'ur', vietnamese: 'vi', welsh: 'cy',

  // Names people actually type, and the native names the profile may hold.
  mandarin: 'zh', 'mandarin chinese': 'zh', 'simplified chinese': 'zh',
  'traditional chinese': 'zh', cantonese: 'zh', 中文: 'zh',
  'brazilian portuguese': 'pt', 'portuguese (brazil)': 'pt', português: 'pt',
  'latin american spanish': 'es', castilian: 'es', español: 'es',
  日本語: 'ja', français: 'fr', deutsch: 'de', italiano: 'it',
  'american english': 'en', 'british english': 'en',
  farsi: 'fa', tagalog: 'tl', bokmål: 'no', norsk: 'no',
}

/**
 * A language name as Whisper wants it: an ISO-639-1 code, or undefined.
 *
 * Undefined means auto-detect, and auto-detect is the failure mode this whole
 * function exists to avoid — so callers should treat it as a problem to report
 * rather than a default to accept quietly.
 */
export function toWhisperLanguage(name?: string | null): string | undefined {
  const key = String(name ?? '').trim().toLowerCase()
  if (!key) return undefined
  // Already a code.
  if (/^[a-z]{2}$/.test(key)) return key
  // "French (France)", "Spanish - Latin America" → try the head of the string.
  return ISO[key] ?? ISO[key.split(/[(–—-]/)[0].trim()]
}

async function transcribeOne(blob: Blob, language?: string): Promise<Word[]> {
  if (blob.size === 0) return []
  // Measured on the audio rather than reported about it, so this holds even
  // when a client lies about the duration or predates the recorder's own cap.
  if (blob.size > MAX_TRACK_BYTES) {
    throw new Error(
      `Track is ${(blob.size / 1024 / 1024).toFixed(1)}MB, longer than the ` +
        `${MAX_LESSON_MINUTES}-minute limit. Update the Koku Recorder extension.`,
    )
  }
  const key = process.env.OPENAI_API_KEY
  if (!key) throw new Error('Missing OPENAI_API_KEY')

  const parts: Part[] = [
    { name: 'file', filename: 'track.webm', contentType: 'audio/webm', body: Buffer.from(await blob.arrayBuffer()) },
    { name: 'model', value: 'whisper-1' },
    { name: 'response_format', value: 'verbose_json' },
    { name: 'timestamp_granularities[]', value: 'word' },
    // Segments too, not just words: without asking for them the response has
    // no `segments`, keepConfidentWords() had nothing to judge against, and
    // the hallucination filter below silently never ran (verified across four
    // real transcriptions — segments: 0 every time).
    { name: 'timestamp_granularities[]', value: 'segment' },
  ]
  if (language) {
    parts.push({ name: 'language', value: language })
  } else {
    // Whisper will now detect the language itself, per file, and on a quiet or
    // noisy track it detects the wrong one and then invents fluent text in it.
    // Reaching here means a language name did not resolve to a code — a gap in
    // ISO, not a request to guess — so say so where it can be found.
    console.warn('[whisper] no language code resolved; falling back to auto-detect')
  }

  /**
   * Not fetch(). Node's global fetch aborts when response headers have not
   * arrived within 300s, which is not configurable and does not move when the
   * platform's function timeout is raised — a 52-minute track needs longer
   * than that, and the abort surfaces as a bare "fetch failed" naming nothing.
   * See lib/long-post.
   */
  const res = await postMultipart('https://api.openai.com/v1/audio/transcriptions', parts, {
    headers: { Authorization: `Bearer ${key}` },
  })
  if (res.status < 200 || res.status >= 300) throw new Error(`Whisper failed (${res.status}): ${res.text}`)

  const json = JSON.parse(res.text)
  const words: any[] = Array.isArray(json.words) ? json.words : []
  const all = words
    .map((w) => ({ text: String(w.word ?? w.text ?? '').trim(), start: Number(w.start) || 0, end: Number(w.end) || 0 }))
    .filter((w) => w.text)

  return keepConfidentWords(all, Array.isArray(json.segments) ? json.segments : [])
}

/**
 * Drops words Whisper made up.
 *
 * Given silence or room tone it does not return nothing — it invents fluent
 * text, often in the wrong language entirely. A near-silent laptop mic in an
 * empty room produced a paragraph of Japanese, which then went to the model as
 * if the student had said it.
 *
 * It does flag its own uncertainty per segment, so trust that: a high
 * no_speech_prob means it heard no speech, and a very low avg_logprob means it
 * had to reach. Words outside a trustworthy segment are discarded.
 */
const NO_SPEECH_MAX = 0.6
const AVG_LOGPROB_MIN = -1.0

function keepConfidentWords(words: { text: string; start: number; end: number }[], segments: any[]) {
  if (!segments.length) return words // nothing to judge against — keep as-is

  const trusted = segments.filter(
    (s) => (Number(s.no_speech_prob) || 0) < NO_SPEECH_MAX && (Number(s.avg_logprob) || 0) > AVG_LOGPROB_MIN,
  )
  if (!trusted.length) {
    console.warn(`[whisper] all ${segments.length} segments below confidence — track treated as silence`)
    return [] // the whole track was silence or noise
  }

  const kept = words.filter((w) =>
    trusted.some((s) => w.start >= (Number(s.start) || 0) - 0.05 && w.start <= (Number(s.end) || 0) + 0.05),
  )
  // The thresholds have never run on live data, so make what they do visible:
  // a filter quietly eating half a real lesson would otherwise look identical
  // to a clean transcription.
  if (kept.length < words.length) {
    console.warn(`[whisper] confidence filter dropped ${words.length - kept.length}/${words.length} words (${segments.length - trusted.length}/${segments.length} segments untrusted)`)
  }
  return kept
}

/**
 * A turn that is mostly the same token over and over.
 *
 * Whisper's other failure on near-silence is a repetition loop — it latches
 * onto a phrase and repeats it, confidently, so no_speech_prob and avg_logprob
 * both look healthy. Real speech does not reuse the same handful of tokens for
 * a dozen words straight; the threshold is deliberately generous so a student
 * drilling a phrase survives.
 */
const MIN_WORDS_TO_JUDGE = 12
const MIN_UNIQUE_RATIO = 0.35
/** A phrase cycling this many times back-to-back is not how people speak. */
const MIN_CYCLES = 3
const MAX_CYCLE_LEN = 5

function isRepetitionLoop(words: Word[]): boolean {
  const toks = words.map((w) => w.text.toLowerCase()).filter(Boolean)

  // Long turn made of very few distinct tokens.
  if (toks.length >= MIN_WORDS_TO_JUDGE) {
    if (new Set(toks).size / toks.length < MIN_UNIQUE_RATIO) return true
  }

  // Short turn that is one phrase looping — "最後の一部。最後の一部。最後の一部。"
  // Requires three consecutive repeats, so ordinary doubling ("I see I see")
  // and a student drilling a phrase twice are both safe.
  for (let n = 1; n <= MAX_CYCLE_LEN; n++) {
    for (let start = 0; start + n * MIN_CYCLES <= toks.length; start++) {
      let cycles = 1
      while (
        start + n * (cycles + 1) <= toks.length &&
        toks.slice(start, start + n).join(' ') ===
          toks.slice(start + n * cycles, start + n * (cycles + 1)).join(' ')
      ) cycles++
      if (cycles >= MIN_CYCLES && n * cycles >= toks.length * 0.6) return true
    }
  }
  return false
}

/** Group one speaker's words into turns, breaking on silence. */
function toSegments(words: Word[], speaker: string, isHost: boolean) {
  const segments: any[] = []
  let current: Word[] = []

  const flush = () => {
    if (!current.length) return
    if (isRepetitionLoop(current)) { current = []; return }
    segments.push({
      participant: { name: speaker, is_host: isHost },
      words: current.map((w) => ({
        text: w.text,
        start_timestamp: { relative: w.start },
        end_timestamp: { relative: w.end },
      })),
    })
    current = []
  }

  for (const w of words) {
    if (current.length && w.start - current[current.length - 1].end >= TURN_GAP_SEC) flush()
    current.push(w)
  }
  flush()
  return segments
}

// Latin-1 accents, kana and CJK are kept so French and Japanese survive; the
// `u` flag and \p{L} are avoided because this project compiles to ES5.
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9À-ɏ぀-ヿ一-鿿]/g, '')

/** second → word → the exact times it was spoken at. */
type Buckets = Record<number, Record<string, number[]>>

/** Words bucketed by whole second, so overlap lookups stay O(1) per word. */
function bucketWords(segments: any[]): Buckets {
  const buckets: Buckets = {}
  for (const seg of segments) {
    for (const w of seg.words) {
      const at = w.start_timestamp.relative
      const text = norm(w.text)
      if (!text) continue
      const s = Math.floor(at)
      if (!buckets[s]) buckets[s] = {}
      if (!buckets[s][text]) buckets[s][text] = []
      buckets[s][text].push(at)
    }
  }
  return buckets
}

/**
 * Closest time the other track says `text`, or null.
 *
 * The exact time matters, not the bucket it landed in: echo lag is a couple of
 * hundred milliseconds, so comparing against a whole-second index buried the
 * signal under its own rounding and threw away real speech.
 */
function findEcho(buckets: Buckets, text: string, at: number, window: number): number | null {
  let best: number | null = null
  for (let s = Math.floor(at - window); s <= Math.floor(at + window); s++) {
    const times = buckets[s] && buckets[s][text]
    if (!times) continue
    for (const t of times) {
      if (Math.abs(t - at) > window) continue
      if (best === null || Math.abs(t - at) < Math.abs(best - at)) best = t
    }
  }
  return best
}

/**
 * Removes speaker bleed, so the teacher does not have to wear headphones.
 *
 * On speakers, each side's mic re-captures whatever just came out of them, and
 * both tracks end up carrying both voices. The give-away is that bleed is a
 * *delayed* copy: your mic hears the student only after their audio has played,
 * and their voice reaches our tab track before it reaches our microphone. So
 * when the same words appear on both tracks at nearly the same time, the later
 * one is the echo and the earlier one is the real speaker.
 *
 * That direction test is what makes this safe. Genuine simultaneous speech
 * produces *different* words on the two tracks and is left alone; only a
 * near-duplicate that lags its twin is dropped.
 */
const ECHO_WINDOW_SEC = 1.5
const ECHO_MATCH_RATIO = 0.6
/** How much the per-word offsets may wobble and still count as one copy. */
const ECHO_LAG_JITTER_SEC = 0.45

function dropEcho(segments: any[]): any[] {
  const byTrack: Record<string, any[]> = {}
  for (const seg of segments) {
    const name = seg.participant?.name ?? 'Unknown'
    if (!byTrack[name]) byTrack[name] = []
    byTrack[name].push(seg)
  }
  const names = Object.keys(byTrack)
  if (names.length < 2) return segments

  const bucketsFor: Record<string, Buckets> = {}
  for (const name of names) bucketsFor[name] = bucketWords(byTrack[name])

  return segments.filter((seg) => {
    const name = seg.participant?.name ?? 'Unknown'
    const words = seg.words.filter((w: any) => norm(w.text))
    if (words.length === 0) return false

    const lags: number[] = []
    for (const other of names) {
      if (other === name) continue
      for (const w of words) {
        const at = w.start_timestamp.relative
        const echoAt = findEcho(bucketsFor[other], norm(w.text), at, ECHO_WINDOW_SEC)
        if (echoAt !== null) lags.push(at - echoAt)
      }
    }

    if (lags.length / words.length < ECHO_MATCH_RATIO) return true // genuinely this speaker

    // Matching words alone are not echo. Two people discussing one topic in one
    // language reuse "the", "I", "Japanese" constantly, and within a 1.5s window
    // enough of those collide by chance to clear the ratio — which deleted most
    // of a real speaker's turns.
    //
    // Echo is a *copy*: every word offset by the same delay. Coincidence
    // scatters. So demand a consistent offset, and that this copy came second.
    const mean = lags.reduce((a, b) => a + b, 0) / lags.length
    const variance = lags.reduce((a, b) => a + (b - mean) ** 2, 0) / lags.length
    if (Math.sqrt(variance) > ECHO_LAG_JITTER_SEC) return true // scattered — not a copy
    return mean <= 0 // keep the copy that came first; the later one is the echo
  })
}

/** One track's words, before any speaker is attached to them. */
export type TrackWords = { speaker: string; isHost: boolean; words: Word[] }

/**
 * Everything that happens AFTER transcription: turn splitting, interleaving,
 * echo removal.
 *
 * Split out from the transcribing so a rebuild can run it over words that were
 * saved the first time round, instead of paying to hear the same audio again.
 * It is pure — same words in, same transcript out — which is what makes a
 * cached rebuild identical to the original rather than merely similar.
 */
export function assembleTracks(tracks: TrackWords[]) {
  const perTrack = tracks.map((t) => ({
    speaker: t.speaker,
    isHost: t.isHost,
    segments: toSegments(t.words, t.speaker, t.isHost),
  }))
  const all = perTrack
    .map((p) => p.segments)
    .flat()
    .sort((a, b) => (a.words[0]?.start_timestamp.relative ?? 0) - (b.words[0]?.start_timestamp.relative ?? 0))
  return { perTrack, all, filtered: dropEcho(all) }
}

/**
 * Transcribe every track and interleave them into one time-ordered transcript.
 * Both tracks start at the same instant, so their relative timestamps align.
 */
export async function transcribeTracks(tracks: TrackInput[], language?: string): Promise<any[]> {
  return (await transcribeTracksDetailed(tracks, language)).filtered
}

/**
 * Same work, but keeps the intermediate stages so they can be inspected —
 * what each track heard on its own, and what the echo filter then removed.
 * Without this, a transcript problem and a filter problem look identical.
 *
 * `words` is the raw transcription, which is the thing worth saving: it is what
 * the money was spent on, and everything below it is free to recompute.
 */
export async function transcribeTracksDetailed(tracks: TrackInput[], language?: string) {
  const words: TrackWords[] = await Promise.all(
    tracks.map(async (t) => ({
      speaker: t.speaker,
      isHost: t.isHost,
      words: await transcribeOne(t.blob, language),
    })),
  )
  return { words, ...assembleTracks(words) }
}

/** "12.3s Speaker: words" — for reading a transcript back. */
export function renderLines(segments: any[]): string[] {
  return segments.map((s) => {
    const at = (s.words[0]?.start_timestamp.relative ?? 0).toFixed(1)
    return `${at}s ${s.participant.name}: ${s.words.map((w: any) => w.text).join(' ')}`
  })
}

/** Exported for testing the echo filter without calling Whisper. */
export const __test = { dropEcho, toSegments }
