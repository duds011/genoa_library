// Furigana markup for test questions.
//
// Kanji + kana tests carry their readings inline as 漢字[かんじ] so they can be
// rendered as ruby text sitting above the kanji. A reading attaches to the run
// of kanji immediately before its bracket:
//
//   日本[にほん]に行[い]きます  →  日本 with にほん above it, 行 with い above it
//
// Anything that doesn't fit that shape is left alone as plain text, so a stray
// bracket can never swallow part of a question.

export interface FuriganaSegment {
  /** The text as the student reads it — kanji when `ruby` is set. */
  base: string
  /** The reading shown above `base`, when there is one. */
  ruby?: string
}

// Kanji, plus 々 (repeat mark), 〇 and the compatibility block — the characters
// a reading can sit on. Kana never carries furigana.
const KANJI_CHAR = /[々〇㐀-䶿一-鿿豈-﫿]/
const KANJI_RUN = /[々〇㐀-䶿一-鿿豈-﫿]+/
const KANA_RUN = /[ぁ-ゟ゠-ヿー]+/

// A reading longer than this is almost certainly not a reading, so we leave the
// brackets as literal text rather than hiding real content above a kanji.
const MAX_READING = 24

// The AI (and older tests) sometimes write the reading in parentheses instead:
// 学校(がっこう). Same intent, so fold it into the canonical form.
const LEGACY_PARENS = new RegExp(
  `(${KANJI_RUN.source})[（(](${KANA_RUN.source})[）)]`,
  'g',
)

/** Fold the accepted variants into the canonical 漢字[かんじ] form. */
export function normalizeFurigana(input: string | null | undefined): string {
  if (!input) return ''
  return input
    .replace(/［/g, '[')
    .replace(/］/g, ']')
    .replace(LEGACY_PARENS, (match, kanji: string, reading: string) =>
      reading.length <= MAX_READING ? `${kanji}[${reading}]` : match,
    )
}

/** How many characters at the end of `text` form an unbroken kanji run. */
function trailingKanjiRun(text: string): number {
  let i = text.length
  while (i > 0 && KANJI_CHAR.test(text[i - 1])) i -= 1
  return text.length - i
}

/**
 * Split text into segments, each either plain text or a kanji run with its
 * reading. Newlines are preserved inside the plain segments, so a passage still
 * renders line by line under `whitespace-pre-line`.
 */
export function parseFurigana(input: string | null | undefined): FuriganaSegment[] {
  const text = normalizeFurigana(input)
  if (!text) return []

  const segments: FuriganaSegment[] = []
  let buffer = ''

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    if (char !== '[') {
      buffer += char
      continue
    }

    const end = text.indexOf(']', i + 1)
    const reading = end === -1 ? '' : text.slice(i + 1, end)
    const runLength = trailingKanjiRun(buffer)

    // Not a reading we can attach — keep the bracket as ordinary text.
    if (end === -1 || !reading || reading.length > MAX_READING || runLength === 0) {
      buffer += char
      continue
    }

    const before = buffer.slice(0, buffer.length - runLength)
    if (before) segments.push({ base: before })
    segments.push({ base: buffer.slice(buffer.length - runLength), ruby: reading })
    buffer = ''
    i = end
  }

  if (buffer) segments.push({ base: buffer })
  return segments
}

/** The text without any readings — what the student actually types or picks. */
export function stripFurigana(input: string | null | undefined): string {
  return parseFurigana(input).map(s => s.base).join('')
}

/** True when at least one reading is attached. */
export function hasFurigana(input: string | null | undefined): boolean {
  return parseFurigana(input).some(s => s.ruby)
}

/** True when there is a kanji at all — i.e. furigana could apply here. */
export function hasKanji(input: string | null | undefined): boolean {
  return !!input && KANJI_CHAR.test(input)
}

/**
 * The kanji that are still bare — no reading attached. Drives the nudge in the
 * question editor so Noa can see at a glance what the AI skipped.
 */
export function kanjiWithoutReading(input: string | null | undefined): string[] {
  const bare = parseFurigana(input)
    .filter(s => !s.ruby)
    .flatMap(s => Array.from(s.base).filter(c => KANJI_CHAR.test(c)))
  return Array.from(new Set(bare))
}

/**
 * Compare two answers ignoring furigana, so a reading Noa fixed on the option
 * but not on the answer key (or the other way round) still grades correctly.
 */
export function sameAnswer(a: string | null | undefined, b: string | null | undefined): boolean {
  return stripFurigana(a).trim() === stripFurigana(b).trim()
}

// Keys inside a question's `data` that never hold Japanese, so they are left
// untouched when normalising a generated question.
const NON_JAPANESE_KEYS = new Set(['hint', 'guidance', 'focus', 'script', 'romaji', 'prompt_romaji', 'question_romaji'])

/**
 * Walk a generated question's `data` and canonicalise the furigana markup in
 * every Japanese string, so what Noa edits is always the same one syntax.
 */
export function normalizeFuriganaDeep<T>(value: T, key?: string): T {
  if (typeof value === 'string') {
    return (key && NON_JAPANESE_KEYS.has(key) ? value : normalizeFurigana(value)) as unknown as T
  }
  if (Array.isArray(value)) {
    return value.map(v => normalizeFuriganaDeep(v, key)) as unknown as T
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) out[k] = normalizeFuriganaDeep(v, k)
    return out as unknown as T
  }
  return value
}
