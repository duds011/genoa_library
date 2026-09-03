'use client'

import React from 'react'
import { levelScale } from './VocabLevelBreakdown'

/* ── Formatted-content renderer ──
   The model emits section content with single newlines (not blank-line blocks),
   so we classify line-by-line: vocab bullets, 3-line JP/romaji/EN examples,
   **Pattern:** lines, Natural note:/Important: callouts, and plain paragraphs. */
function hasJapanese(t: string) { return /[　-ヿ㐀-鿿＀-￯]/.test(t) }
function isRomajiLine(t: string) {
  const s = t.replace(/\*\*?.+?\*\*?/g, '').trim()
  return /^[a-z][a-z\s.,\-'!?()ā-žāīūēōãñ]*$/i.test(s) && s.length > 0 && !hasJapanese(t)
}
function isPureJapanese(t: string) {
  if (!hasJapanese(t)) return false
  // Strip bold AND italic wrappers — the old \*[^*]+\* mangled "**word**",
  // leaving stray asterisks that then rendered literally.
  return !/[a-zA-Z]/.test(t.replace(/\*\*?[^*]+\*\*?/g, ''))
}
/** Render **bold** and *italic* (romaji) inline. */
function inline(text: string): React.ReactNode {
  const tokens = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean)
  return tokens.map((tok, i) => {
    if (/^\*\*[^*]+\*\*$/.test(tok)) return <strong key={i}>{tok.slice(2, -2)}</strong>
    if (/^\*[^*]+\*$/.test(tok)) return <em key={i} className="romaji">{tok.slice(1, -1)}</em>
    return <span key={i}>{tok}</span>
  })
}

type Ex = { t: 'jp' | 'rom' | 'en'; v: string }

export function FormattedContent({ content }: { content: any }) {
  let text = content
  if (Array.isArray(text)) text = text.join('\n')
  if (typeof text !== 'string' || !text.trim()) return null

  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  const nodes: React.ReactNode[] = []
  let bullets: string[] = []
  let example: Ex[] = []
  let key = 0

  const flushBullets = () => {
    if (!bullets.length) return
    nodes.push(<ul key={key++} className="fc-list">{bullets.map((b, i) => <li key={i}>{inline(b)}</li>)}</ul>)
    bullets = []
  }
  const flushExample = () => {
    if (!example.length) return
    nodes.push(
      <div key={key++} className="ex">
        {example.map((e, i) =>
          e.t === 'jp' ? <p key={i} className="jp" style={{ margin: '.1rem 0' }}>{e.v}</p>
            : e.t === 'rom' ? <p key={i} className="romaji" style={{ margin: '.1rem 0' }}>{e.v}</p>
              : <p key={i} style={{ margin: '.1rem 0', fontSize: '.9rem' }}>{e.v}</p>
        )}
      </div>
    )
    example = []
  }

  for (const line of lines) {
    if (/^[-•→]/.test(line)) { flushExample(); bullets.push(line.replace(/^[-•→]\s*/, '')); continue }
    flushBullets()
    // Instruction-language recaps translate the callout keywords (パターン,
    // ポイント…) and may bold-wrap them, so probe with asterisks stripped and
    // fall back to "any bold lead-in ending in a colon" for other languages.
    const probe = line.replace(/\*/g, '').trim()
    if (/^(pattern|パターン)\s*[:：]/i.test(probe) || /^\*\*[^*]{1,24}[:：]\s*\*\*/.test(line)) { flushExample(); nodes.push(<p key={key++} className="pattern-line">{inline(line)}</p>); continue }
    if (/^(natural note|teacher note|important word order|important|note|tip|ポイント|注意|ヒント|メモ|自然な英語|自然な表現|大事|大切)\s*[:：]/i.test(probe)) { flushExample(); nodes.push(<p key={key++} className="callout">{inline(line)}</p>); continue }
    if (isPureJapanese(line)) { if (example.length && example[example.length - 1].t === 'en') flushExample(); example.push({ t: 'jp', v: line }); continue }
    if (isRomajiLine(line)) { example.push({ t: 'rom', v: line }); continue }
    if (example.length) { example.push({ t: 'en', v: line }); continue } // translation of current example
    nodes.push(<p key={key++} style={{ fontSize: '.9rem', margin: '.3rem 0' }}>{inline(line)}</p>)
  }
  flushExample(); flushBullets()
  return <>{nodes}</>
}

/* ── Full recap body (stats + recap + sections + vocab + homework + exercises) ── */
export function RecapBody({ recap }: { recap: any }) {
  const dist: Record<string, number> = recap.vocab_level_distribution || {}
  return (
    <div>
      <div className="mini-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        <div className="mini"><div className="k">Score</div><div className="v">{recap.score}</div></div>
        <div className="mini"><div className="k">Student talk</div><div className="v">{recap.talk_percentage}%</div></div>
        <div className="mini"><div className="k">Grammar</div><div className="v" style={{ fontSize: '.85rem', paddingTop: '.4rem' }}>{recap.grammar_density}</div></div>
        <div className="mini"><div className="k">Confidence</div><div className="v" style={{ fontSize: '.85rem', paddingTop: '.4rem' }}>{recap.confidence_label}</div></div>
      </div>

      <div className="block"><FormattedContent content={recap.recap} /></div>

      {(recap.sections || []).map((s: any, i: number) => (
        <div className="block" key={i}>
          <h4>{s.title}</h4>
          <FormattedContent content={s.content} />
        </div>
      ))}

      {recap.vocabulary?.length > 0 && (
        <div className="block">
          <h4>Vocabulary {recap.vocab_total_count ? `· ${recap.vocab_total_count} items` : ''}</h4>
          {/* The scale follows the language — JLPT hardcoded here showed a
              French lesson five zeros. */}
          {Object.keys(dist).length > 0 && (
            <div className="jlpt-row">{levelScale(dist).map((lv) => <span key={lv} className="jlpt">{lv}: {dist[lv] ?? 0}</span>)}</div>
          )}
          <ul className="fc-list">
            {recap.vocabulary.map((v: any, i: number) => (
              <li key={i}>
                <span className="jp">{v.word}</span> <span className="romaji">{v.reading}</span> — {v.definition}
                {v.jlpt_level && <span className="jlpt sm"> {v.jlpt_level}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Array.isArray, not .length: a string has a length and then throws on
          .map. Same fix as LessonPageTabs. */}
      {Array.isArray(recap.homework) && recap.homework.length > 0 && (
        <div className="block">
          <h4>Homework</h4>
          <ul className="fc-list">{recap.homework.map((h: any, i: number) => <li key={i}>{h?.description ?? String(h)}</li>)}</ul>
        </div>
      )}

      {recap.exercises?.length > 0 && (
        <div className="block">
          <h4>Practice exercises ({recap.exercises.length})</h4>
          <ul className="fc-list">{recap.exercises.map((e: any, i: number) => <li key={i}><strong>{e.type}</strong> — {e.prompt}</li>)}</ul>
        </div>
      )}

      {recap.audio_script && (
        <div className="block">
          <h4>Voice memo script</h4>
          <p style={{ whiteSpace: 'pre-wrap', fontSize: '.88rem' }}>{recap.audio_script}</p>
        </div>
      )}

      {recap.teacher_note && (
        <div className="block"><h4>Teacher’s note</h4><p>{recap.teacher_note}</p></div>
      )}
    </div>
  )
}
