'use client'

import { useRef, useState } from 'react'
import { FormattedContent } from './RecapView'

type Section = { title: string; content: string }

/**
 * "What we covered" — the fourteen-part write-up, opened one part at a time.
 *
 * Flat, this is the longest thing in the recap and the part students abandon.
 * As a list of headings it is a contents page you can scan, and the part you
 * tap opens into what was actually taught.
 *
 * One component, two shapes, no JS branch: on a phone the body follows its
 * button and expands under it; past the container breakpoint the buttons pin
 * to column one and the open body fills column two beside them. See .kr-md.
 */

/** The shape the recap generator writes each section body in. */
type Parsed = {
  prose: string
  terms: [string, string][]
  examples: string[]
  notes: [string, string][]
}

/**
 * Split a body into its parts: one prose paragraph, `- **term** — gloss`
 * lines, bare example sentences, then Pattern / Natural note lines.
 *
 * Returns null when nothing structured is found, so older recaps — written
 * before this shape existed — fall through to plain formatted content rather
 * than being mangled into empty headings.
 */
function parse(content: string): Parsed | null {
  const out: Parsed = { prose: '', terms: [], examples: [], notes: [] }
  for (const raw of String(content ?? '').split('\n')) {
    const ln = raw.trim()
    if (!ln) continue
    const term = ln.match(/^-\s*\*\*(.+?)\*\*\s*[—–-]\s*(.+)$/)
    if (term) { out.terms.push([term[1].trim(), term[2].trim()]); continue }
    const note = ln.match(/^(Pattern|Natural note)\s*:\s*(.+)$/i)
    if (note) { out.notes.push([note[1], note[2].trim()]); continue }
    if (!out.prose && out.terms.length === 0) out.prose = ln
    else out.examples.push(ln)
  }
  if (out.terms.length === 0 && out.examples.length === 0 && out.notes.length === 0) return null
  return out
}

/** Section titles arrive numbered ("1. Lecture guidée"); the list numbers itself. */
const stripNumber = (t: string) => String(t ?? '').replace(/^\s*\d+\.\s*/, '').trim()

function Body({ section }: { section: Section }) {
  const p = parse(section.content)
  if (!p) return <div className="kr-sec-in"><FormattedContent content={section.content} /></div>

  return (
    <div className="kr-sec-in">
      <h4 className="kr-sec-title">{stripNumber(section.title)}</h4>
      {p.prose && <p className="kr-prose">{p.prose}</p>}

      {p.terms.length > 0 && (
        <>
          <p className="kr-sublab">Words introduced</p>
          <div className="kr-terms">
            {p.terms.map(([term, gloss], i) => (
              <div className="kr-term" key={i}><b>{term}</b><span>{gloss}</span></div>
            ))}
          </div>
        </>
      )}

      {p.examples.length > 0 && (
        <>
          <p className="kr-sublab">From the lesson</p>
          {p.examples.map((e, i) => <p className="kr-eg" key={i}>{e}</p>)}
        </>
      )}

      {p.notes.map(([kind, text], i) => (
        <div className="kr-note" key={i}><b>{kind}</b> — {text}</div>
      ))}
    </div>
  )
}

export default function RecapSections({ sections }: { sections: Section[] }) {
  // Accordion, not multi-open: fourteen bodies open at once is the wall this
  // replaced. On the wide layout it is also what keeps column two to one panel.
  const [open, setOpen] = useState(0)
  const bodies = useRef<(HTMLDivElement | null)[]>([])

  if (sections.length === 0) return null

  return (
    <div className="kr-md">
      {sections.map((s, i) => (
        <div className="kr-sec-pair" key={i} style={{ display: 'contents' }}>
          <button
            type="button"
            className={`kr-sec-btn${open === i ? ' open' : ''}`}
            aria-expanded={open === i}
            onClick={() => setOpen(open === i ? -1 : i)}
          >
            <span className="kr-sec-n">{String(i + 1).padStart(2, '0')}</span>
            <span className="kr-sec-t">{stripNumber(s.title)}</span>
            <svg className="kr-sec-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <div
            className={`kr-sec-body${open === i ? ' open' : ''}`}
            ref={(el) => { bodies.current[i] = el }}
            // The narrow layout animates height, so it needs a real number;
            // the wide one ignores it entirely (max-height:none).
            style={{ maxHeight: open === i ? (bodies.current[i]?.scrollHeight ?? 2000) : 0 }}
          >
            <Body section={s} />
          </div>
        </div>
      ))}
    </div>
  )
}
