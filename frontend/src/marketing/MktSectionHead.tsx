import type { ReactNode } from 'react'

type Props = {
  eyebrow?: string
  title: ReactNode
  lead?: string
  id?: string
  align?: 'left' | 'center'
}

export function MktSectionHead({ eyebrow, title, lead, id, align = 'left' }: Props) {
  return (
    <div className={`mkt-section-head${align === 'center' ? ' is-center' : ''}`}>
      {eyebrow ? <span className="mkt-eyebrow">{eyebrow}</span> : null}
      <h2 id={id}>{title}</h2>
      {lead ? <p>{lead}</p> : null}
    </div>
  )
}
