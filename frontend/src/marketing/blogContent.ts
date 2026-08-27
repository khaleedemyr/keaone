import DOMPurify, { type Config } from 'dompurify'

const PURIFY_OPTS: Config = {
  ALLOWED_TAGS: [
    'p',
    'h2',
    'h3',
    'h4',
    'strong',
    'em',
    'u',
    'a',
    'ul',
    'ol',
    'li',
    'blockquote',
    'img',
    'br',
    'hr',
  ],
  ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'target', 'rel', 'class'],
}

export function isHtmlBody(body: string): boolean {
  const trimmed = body.trim()
  if (!trimmed) return false
  return /^<[a-z][\s\S]*>/i.test(trimmed)
}

export function sanitizeBlogHtml(html: string): string {
  return DOMPurify.sanitize(html, PURIFY_OPTS) as string
}

export function plainTextToHtml(body: string): string {
  const parts = body
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)

  return parts
    .map((part) => {
      const inner = part
        .split('\n')
        .map((line) => DOMPurify.sanitize(line))
        .join('<br>')
      return `<p>${inner}</p>`
    })
    .join('')
}

export function prepareBlogHtml(body: string): string {
  if (!body.trim()) return ''
  const html = isHtmlBody(body) ? body : plainTextToHtml(body)
  return sanitizeBlogHtml(html)
}
