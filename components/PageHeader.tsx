import type React from 'react'

export type HeaderFigure = { label: string; value: React.ReactNode }

type Props = {
  eyebrow?: string
  title: React.ReactNode
  /** Optional line of context beside the title, e.g. an email or a level. */
  meta?: React.ReactNode
  /** The page's headline numbers, set inside the band instead of under it. */
  figures?: HeaderFigure[]
  actions?: React.ReactNode
  /**
   * Give the actions their own full-width row inside the band, so children
   * can spread left/right with marginLeft:auto.
   */
  wideActions?: boolean
  /** Something to sit left of the title — an avatar, usually. */
  lead?: React.ReactNode
}

/**
 * One band, one line: eyebrow and title on the left, the page's numbers in the
 * middle, its actions on the right. The brand-blue header every teacher page
 * opens with — ported from Lesson Studio's PageHeader.
 */
export default function PageHeader({ eyebrow, title, meta, figures, actions, wideActions, lead }: Props) {
  return (
    <header className="k-thead one">
      <div className="k-thead-title">
        {lead}
        <div style={{ minWidth: 0 }}>
          {eyebrow && <span className="k-phead-eyebrow">{eyebrow}</span>}
          <h1>{title}</h1>
          {meta && <p className="k-thead-meta">{meta}</p>}
        </div>
      </div>

      {figures && figures.length > 0 && (
        <div className="k-thead-figures">
          {figures.map((f) => (
            <div key={f.label}>
              <span>{f.label}</span>
              <b>{f.value}</b>
            </div>
          ))}
        </div>
      )}

      {actions && <div className={`k-thead-actions${wideActions ? ' wide' : ''}`}>{actions}</div>}
    </header>
  )
}
