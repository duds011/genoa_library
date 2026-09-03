'use client'

import { useMemo, useState } from 'react'

type Card = { word: string; reading?: string; definition?: string; jlpt_level?: string }

/**
 * Flip cards over one lesson's vocabulary.
 *
 * Word on the front; reading, meaning and level on the back. "Knew it" retires
 * the card, "Again" sends it to the back of the deck, and the round ends when
 * everything has been retired — so a student cannot finish by clicking past
 * words they missed. All local state: this is practice, not assessment, and
 * nothing needs a server to flip a card.
 */
export default function Flashcards({ vocabulary }: { vocabulary: Card[] }) {
  const deck = useMemo(
    () => (Array.isArray(vocabulary) ? vocabulary.filter((v) => v?.word) : []),
    [vocabulary],
  )
  // Queue of indexes still in play, front of the array = current card.
  const [queue, setQueue] = useState<number[]>(() => deck.map((_, i) => i))
  const [flipped, setFlipped] = useState(false)
  const [round, setRound] = useState(1)

  if (deck.length === 0) return null

  const restart = () => {
    setQueue(deck.map((_, i) => i))
    setFlipped(false)
    setRound((r) => r + 1)
  }

  if (queue.length === 0) {
    return (
      <div className="fc-done">
        <span aria-hidden>🎉</span>
        <strong>All {deck.length} words done{round > 1 ? ` — round ${round}` : ''}.</strong>
        <button type="button" className="btn btn-ghost btn-sm" onClick={restart}>Go again</button>
      </div>
    )
  }

  const card = deck[queue[0]]

  const knew = () => { setFlipped(false); setQueue(queue.slice(1)) }
  const again = () => { setFlipped(false); setQueue([...queue.slice(1), queue[0]]) }

  return (
    <div className="fc-wrap">
      <div className="fc-meta">
        <span>🃏 Flashcards</span>
        <span>{deck.length - queue.length + 1} / {deck.length}</span>
      </div>

      <button
        type="button"
        className={`fc-card ${flipped ? 'is-flipped' : ''}`}
        onClick={() => setFlipped((f) => !f)}
        aria-label={flipped ? 'Show the word' : 'Show the meaning'}
      >
        {!flipped ? (
          <span className="fc-front jp">{card.word}</span>
        ) : (
          <span className="fc-back">
            {card.reading && <span className="fc-reading">{card.reading}</span>}
            <span className="fc-def">{card.definition || '—'}</span>
            {card.jlpt_level && <span className="jlpt sm">{card.jlpt_level}</span>}
          </span>
        )}
        <span className="fc-hint">{flipped ? 'tap to see the word' : 'tap to reveal'}</span>
      </button>

      {/* Judging an unflipped card is guessing — the buttons wait for the flip. */}
      <div className="fc-actions" style={{ visibility: flipped ? 'visible' : 'hidden' }}>
        <button type="button" className="fc-btn no" onClick={again}>↩ Again</button>
        <button type="button" className="fc-btn ok" onClick={knew}>✓ Knew it</button>
      </div>
    </div>
  )
}
