'use client'

import { useRef, useState } from 'react'
import { FormattedContent, inline, isPureJapanese, isRomajiLine } from './RecapView'

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
  /** term, reading (may be empty), gloss */
  terms: [string, string, string][]
  examples: string[]
  notes: [string, string][]
}

const NOTE_KINDS = /^(Pattern|Natural note|Teacher note|Important word order|Important|Note|Tip)\s*[:：]\s*(.+)$/i

/**
 * Split a body into its parts: one prose paragraph, `- **term** *reading* —
 * gloss` lines, bare example sentences, then Pattern / Tip / note lines.
 *
 * Both patterns are deliberately loose, and that is the whole point. The
 * generator writes `- **とおもう** *to omou* — to think (that)` and
 * `**Pattern:** …`, while the first version of this parser wanted the dash
 * immediately after the bold term and a bare `Pattern:` carrying no asterisks.
 * Neither matched, so both fell through to "examples" and rendered with their
 * markdown showing — in 508 of the 1000 sections stored here.
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
    // Notes go first: a note is the one line whose bold run is its keyword, so
    // testing it before the term pattern keeps `**Note** — …` out of the
    // vocabulary list. Probe with the emphasis stripped, because the keyword
    // and its colon usually arrive wrapped together, as `**Pattern:**`.
    const note = ln.replace(/[*_]/g, '').trim().match(NOTE_KINDS)
    if (note) { out.notes.push([note[1], note[2].trim()]); continue }
    // A term line: a bold word, an optional reading in whatever wrapper this
    // recap happened to use, a separator, then the gloss. The generator has
    // written the reading as *to omou*, / ichiban and (Noa no mae) across
    // different eras, so take whatever sits between the term and the separator
    // and strip the wrapper rather than enumerating the shapes.
    // A bare hyphen only separates when it stands alone between spaces —
    // otherwise a hyphenated reading like *o-negai* splits down the middle.
    const term = ln.match(/^[-•]?\s*\*\*(.+?)\*\*\s*(.*?)\s*(?:[:：—–]|\s-\s)\s*(.+)$/)
    if (term) {
      const reading = term[2].replace(/^[/／([]\s*/, '').replace(/\s*[)\]]$/, '').replace(/[*_]/g, '').trim()
      out.terms.push([term[1].trim(), reading, term[3].trim()])
      continue
    }
    if (!out.prose && out.terms.length === 0) out.prose = ln
    else out.examples.push(ln)
  }
  if (out.terms.length === 0 && out.examples.length === 0 && out.notes.length === 0) return null
  return out
}

/**
 * Style each example line as what it is within its run.
 *
 * "I thought I wanted to study Japanese." is latin letters end to end, so a
 * line-by-line romaji test calls it romaji and the English gloss ends up in the
 * same grey italic as the reading. Position settles it: after a Japanese line
 * the first latin line is the reading, and anything after that is the meaning.
 */
function exampleClasses(examples: string[]): string[] {
  let readingTaken = false
  return examples.map((e) => {
    if (isPureJapanese(e)) { readingTaken = false; return ' jp' }
    if (!readingTaken && isRomajiLine(e)) { readingTaken = true; return ' rom' }
    return ''
  })
}

/** Section titles arrive numbered ("1. Lecture guidée"); the list numbers itself. */
const stripNumber = (t: string) => String(t ?? '').replace(/^\s*\d+\.\s*/, '').trim()

function Body({ section }: { section: Section }) {
  const p = parse(section.content)
  if (!p) return <div className="kr-sec-in"><FormattedContent content={section.content} /></div>

  return (
    <div className="kr-sec-in">
      <h4 className="kr-sec-title">{stripNumber(section.title)}</h4>
      {p.prose && <p className="kr-prose">{inline(p.prose)}</p>}

      {p.terms.length > 0 && (
        <>
          <p className="kr-sublab">Words introduced</p>
          <div className="kr-terms">
            {p.terms.map(([term, reading, gloss], i) => (
              <div className="kr-term" key={i}>
                <b>{term}</b>
                <span>
                  {reading && <em className="kr-term-read">{reading}</em>}
                  {inline(gloss)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {p.examples.length > 0 && (
        <>
          <p className="kr-sublab">From the lesson</p>
          {/* A three-line example is the Japanese, its romaji, then the English.
              Rendering all three the same way made the block a stack of matching
              italics; the classes let each line read as the thing it is. */}
          {exampleClasses(p.examples).map((cls, i) => (
            <p key={i} className={`kr-eg${cls}`}>{inline(p.examples[i])}</p>
          ))}
        </>
      )}

      {p.notes.map(([kind, text], i) => (
        <div className="kr-note" key={i}><b>{kind}</b> — {inline(text)}</div>
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
            style={{
              // The narrow layout animates height, so it needs a real number;
              // the wide one ignores it entirely (max-height:none).
              maxHeight: open === i ? (bodies.current[i]?.scrollHeight ?? 2000) : 0,
              // Start the panel on its own button's row, so it opens BESIDE the
              // part you clicked. The stylesheet pinned every panel to row 1,
              // which put the writing up beside part 01 however far down the
              // list you were — opening part 04 answered you at the top of the
              // page. Ignored on the narrow layout, which is not a grid.
              gridRow: `${i + 1} / span ${Math.max(1, sections.length - i)}`,
            }}
          >
            <Body section={s} />
          </div>
        </div>
      ))}
    </div>
  )
}
