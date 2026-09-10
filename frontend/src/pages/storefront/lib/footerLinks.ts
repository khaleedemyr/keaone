export type FooterLinkAction = 'cart' | 'checkout' | 'account' | 'login'

export type FooterLinkItem = {
  label: string
  href?: string
  action?: FooterLinkAction
}

export type FooterColumn = {
  title: string
  links: FooterLinkItem[]
}

const ACTIONS = new Set<FooterLinkAction>(['cart', 'checkout', 'account', 'login'])

/**
 * Parse footer link lines.
 * Format per line: `Label | target`
 * target: `#anchor`, URL, or action token `cart` / `checkout` / `account` / `login`
 * Label-only lines use fallbackHref.
 */
export function parseFooterLinks(raw: string, fallbackHref = '#'): FooterLinkItem[] {
  return raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const pipe = line.indexOf('|')
      if (pipe < 0) {
        return { label: line, href: fallbackHref }
      }
      const label = line.slice(0, pipe).trim()
      const target = line.slice(pipe + 1).trim().toLowerCase()
      if (!label) return null
      if (ACTIONS.has(target as FooterLinkAction)) {
        return { label, action: target as FooterLinkAction }
      }
      if (!target) return { label, href: fallbackHref }
      return { label, href: line.slice(pipe + 1).trim() }
    })
    .filter((item): item is FooterLinkItem => !!item)
}

function slotText(content: Record<string, unknown>, key: string, fallback: string) {
  const value = content[key]
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

/** Read one footer column from theme_content with defaults. */
export function readFooterColumn(
  content: Record<string, unknown>,
  col: 1 | 2 | 3,
  defaults: { title: string; links: string },
  fallbackHref = '#',
): FooterColumn {
  const title = slotText(content, `footer_col${col}_title`, defaults.title)
  const linksRaw = slotText(content, `footer_col${col}_links`, defaults.links)
  return {
    title,
    links: parseFooterLinks(linksRaw, fallbackHref),
  }
}

/** Legal / bottom links. */
export function readFooterLegal(
  content: Record<string, unknown>,
  defaultRaw: string,
  fallbackHref = '#',
): FooterLinkItem[] {
  return parseFooterLinks(slotText(content, 'footer_legal_links', defaultRaw), fallbackHref)
}

/**
 * Sophia legacy: `footer_services` was label-only lines.
 * Prefer footer_col2_links; if empty/default-missing but footer_services set, convert.
 */
export function readSophiaServicesColumn(content: Record<string, unknown>): FooterColumn {
  const hasCol2 =
    typeof content.footer_col2_links === 'string' && content.footer_col2_links.trim().length > 0
  if (hasCol2 || typeof content.footer_col2_title === 'string') {
    return readFooterColumn(
      content,
      2,
      {
        title: 'Services',
        links:
          'Skin Analysis | #consult\nFacial Treatments | #consult\nBody Care | #consult\nSun Protection | #consult\nConsultation | #consult\nAftercare Support | #consult',
      },
      '#consult',
    )
  }
  const legacy = typeof content.footer_services === 'string' ? content.footer_services.trim() : ''
  if (legacy) {
    return {
      title: slotText(content, 'footer_col2_title', 'Services'),
      links: parseFooterLinks(legacy, '#consult'),
    }
  }
  return readFooterColumn(
    content,
    2,
    {
      title: 'Services',
      links:
        'Skin Analysis | #consult\nFacial Treatments | #consult\nBody Care | #consult\nSun Protection | #consult\nConsultation | #consult\nAftercare Support | #consult',
    },
    '#consult',
  )
}
