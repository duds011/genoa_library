'use client'

import { useState } from 'react'
/** The two shapes the recap writes. Inlined rather than imported: this
 *  portal has no lib/openai — its recaps come from n8n and the recorder. */
export type Correction = { said: string; correction: string; explanation?: string; categories: string[] }
export type Strength = { said: string; note?: string; categories: string[] }

/**
 * What the student said, and what it should have been.
 *
 * The quote is the point: a correction the student can recognise as their own
 * sentence lands, and a generic rule about the language does not. So the two
 * versions are shown side by side with the words that actually changed marked
 * — the wrong ones in the quote, the fix underlined in the correction.
 */

/**
 * Which tokens differ between the two versions, by longest-common-subsequence.
 *
 * Word-level for spaced languages; character-level for Japanese, which has no
 * spaces and would otherwise diff as one giant token and highlight everything.
 */
function tokenize(s: string): string[] {
  return s.includes(' ') ? s.split(/(\s+)/).filter(Boolean) : Array.from(s)
}

function diffFlags(a: string[], b: string[]): { aKeep: boolean[]; bKeep: boolean[] } {
  const n = a.length
  const m = b.length
  // Guard: the table is O(n·m), and these are single sentences. Anything
  // pathological skips the diff rather than stalling the render.
  if (n * m > 40000) return { aKeep: a.map(() => true), bKeep: b.map(() => true) }

  // Japanese punctuation too, or 「あいました」 and 「あいました。」 read as
  // different words and the sentence lights up over a full stop.
  const norm = (t: string) => t.toLowerCase().replace(/[.,!?;:"'。、！？「」]/g, '')
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = norm(a[i]) === norm(b[j]) ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
    }
  }
  const aKeep = new Array(n).fill(false)
  const bKeep = new Array(m).fill(false)
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (norm(a[i]) === norm(b[j])) { aKeep[i] = true; bKeep[j] = true; i++; j++ }
    else if (lcs[i + 1][j] >= lcs[i][j + 1]) i++
    else j++
  }
  return { aKeep, bKeep }
}

function Marked({ tokens, keep, kind }: { tokens: string[]; keep: boolean[]; kind: 'said' | 'fix' }) {
  return (
    <>
      {tokens.map((t, i) =>
        keep[i] || !t.trim() ? (
          <span key={i}>{t}</span>
        ) : (
          <mark key={i} className={kind === 'said' ? 'cx-was' : 'cx-now'}>{t}</mark>
        ),
      )}
    </>
  )
}

function CorrectionCard({ c, who }: { c: Correction; who: string }) {
  const said = tokenize(c.said)
  const fix = tokenize(c.correction)
  const { aKeep, bKeep } = diffFlags(said, fix)

  return (
    <div className="cx-card">
      <span className="cx-label">{who} said</span>
      <p className="cx-line">…<Marked tokens={said} keep={aKeep} kind="said" /></p>

      <span className="cx-label">Correction</span>
      <p className="cx-line cx-fix"><Marked tokens={fix} keep={bKeep} kind="fix" /></p>

      {(c.categories.length > 0 || c.explanation) && (
        <div className="cx-why">
          {c.categories.length > 0 && <strong>{c.categories.join(', ')}</strong>}
          {c.explanation && <p>{c.explanation}</p>}
        </div>
      )}
    </div>
  )
}

export default function LessonCorrections({
  corrections, didWell, who,
}: {
  corrections: Correction[]
  didWell: Strength[]
  /** Whose sentences these are — "You" for the student, their name for the teacher. */
  who: string
}) {
  const [tab, setTab] = useState<'improve' | 'well'>('improve')
  if (corrections.length === 0 && didWell.length === 0) return null

  // With only one side to show, a two-button switcher is furniture.
  const both = corrections.length > 0 && didWell.length > 0
  const showing = both ? tab : corrections.length > 0 ? 'improve' : 'well'

  return (
    <div>
      {both && (
        <div className="cx-tabs" role="tablist" aria-label="Corrections">
          <button
            type="button" role="tab" aria-selected={showing === 'improve'}
            className={`cx-tab ${showing === 'improve' ? 'sel' : ''}`}
            onClick={() => setTab('improve')}
          >
            What {who} can improve <span className="cx-count">{corrections.length}</span>
          </button>
          <button
            type="button" role="tab" aria-selected={showing === 'well'}
            className={`cx-tab ${showing === 'well' ? 'sel' : ''}`}
            onClick={() => setTab('well')}
          >
            What {who} did well <span className="cx-count">{didWell.length}</span>
          </button>
        </div>
      )}

      <div className="cx-grid">
        {showing === 'improve'
          ? corrections.map((c, i) => <CorrectionCard key={i} c={c} who={who} />)
          : didWell.map((s, i) => (
              <div className="cx-card cx-good" key={i}>
                <span className="cx-label">{who} said</span>
                <p className="cx-line">…{s.said}</p>
                <div className="cx-why"><p>{s.note}</p></div>
              </div>
            ))}
      </div>
    </div>
  )
}
