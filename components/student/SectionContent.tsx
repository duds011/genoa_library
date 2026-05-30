'use client'

// Renders AI-generated section content into styled blocks.
// Content uses blank lines to separate blocks. Each block is classified as:
//   • Example box – block that has pure Japanese lines (and/or starts with **Label:**)
//   • Bullet list  – all lines start with -
//   • Callout note – starts with "Natural note:" / "Important" / "Note:"
//   • Regular paragraph

import React from 'react'

interface Props {
  content: string
}

/** Process **bold** markers inside text */
function formatInline(text: string): React.ReactNode {
  const parts = text.split(/\*\*(.+?)\*\*/g)
  if (parts.length === 1) return text
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1
          ? <strong key={i} className="font-semibold text-ink">{part}</strong>
          : <span key={i}>{part}</span>
      )}
    </>
  )
}

/** True if the string contains CJK or kana characters */
function hasJapanese(text: string) {
  return /[　-鿿＀-￯]/.test(text)
}

/** True when a line is (mostly) romaji / pronunciation – all lowercase letters, spaces, punctuation */
function isRomajiLine(text: string) {
  const stripped = text.replace(/\*\*?.+?\*\*?/g, '').trim()
  return /^[a-z][a-z\s.,\-'!?()ā-žāīūēōãñ]*$/i.test(stripped) && stripped.length > 0 && !hasJapanese(text)
}

/** True if a line is pure Japanese (no Latin letters outside of bold markers) */
function isPureJapanese(text: string) {
  if (!hasJapanese(text)) return false
  const withoutBold = text.replace(/\*\*[^*]+\*\*/g, '')
  return !/[a-zA-Z]/.test(withoutBold)
}

export default function SectionContent({ content }: Props) {
  if (!content?.trim()) return null

  const rawBlocks = content.split(/\n\n+/)

  return (
    <div className="space-y-3">
      {rawBlocks.map((block, blockIdx) => {
        const lines = block.split('\n').map(l => l.trim()).filter(Boolean)
        if (!lines.length) return null

        const firstLine = lines[0]

        // ── Callout note ────────────────────────────────────────────────────
        if (/^(natural note|teacher note|important word order|important|note):/i.test(firstLine)) {
          return (
            <p key={blockIdx} className="text-sm text-muted italic border-l-4 border-brand-200 pl-3 py-0.5 leading-relaxed">
              {lines.map((l, i) => (
                <span key={i}>
                  {i > 0 && <br />}
                  {formatInline(l)}
                </span>
              ))}
            </p>
          )
        }

        // ── Bullet list (every line starts with - • or →) ───────────────────
        if (lines.length > 0 && lines.every(l => /^[-•→]/.test(l))) {
          return (
            <ul key={blockIdx} className="space-y-1.5 pl-1">
              {lines.map((l, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-ink/85">
                  <span className="text-brand-300 mt-0.5 shrink-0 select-none">•</span>
                  <span className="leading-relaxed">{formatInline(l.replace(/^[-•→]\s*/, ''))}</span>
                </li>
              ))}
            </ul>
          )
        }

        // ── Example / pattern box (block has at least one Japanese line) ────
        const blockHasJapanese = lines.some(l => hasJapanese(l))
        if (blockHasJapanese) {
          return (
            <div key={blockIdx} className="bg-[#f8f7ff] border border-indigo-100 rounded-xl px-4 py-3 space-y-1">
              {lines.map((l, i) => {
                if (isPureJapanese(l)) {
                  // e.g. アメリカじんです。
                  return (
                    <p key={i} className="font-bold text-brand-800 text-sm leading-relaxed">
                      {l}
                    </p>
                  )
                }
                if (isRomajiLine(l)) {
                  // e.g. Amerika-jin desu.
                  return (
                    <p key={i} className="italic text-purple-600 text-sm leading-relaxed">
                      {l}
                    </p>
                  )
                }
                // e.g. **Pattern:** Country + じん = nationality, or "I am American."
                return (
                  <p key={i} className="text-sm text-ink/80 leading-relaxed">
                    {formatInline(l)}
                  </p>
                )
              })}
            </div>
          )
        }

        // ── Regular paragraph ────────────────────────────────────────────────
        return (
          <p key={blockIdx} className="text-sm text-ink/85 leading-relaxed">
            {lines.map((l, i) => (
              <span key={i}>
                {i > 0 && <br />}
                {formatInline(l)}
              </span>
            ))}
          </p>
        )
      })}
    </div>
  )
}
