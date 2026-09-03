'use client'

// Renders test text with its readings sitting above the kanji, e.g. お茶[ちゃ].
// Text without markup renders exactly as before, so this is safe to use on
// every question regardless of which script the test was built in.

import { parseFurigana } from '@/lib/furigana'

export default function Furigana({
  text,
  className,
}: {
  text?: string | null
  className?: string
}) {
  const segments = parseFurigana(text)
  if (segments.length === 0) return null

  const withRuby = segments.some(s => s.ruby)

  return (
    <span className={[withRuby ? 'has-furigana' : '', className].filter(Boolean).join(' ')}>
      {segments.map((s, i) =>
        s.ruby ? (
          <ruby key={i}>
            {s.base}
            <rt>{s.ruby}</rt>
          </ruby>
        ) : (
          <span key={i}>{s.base}</span>
        ),
      )}
    </span>
  )
}
