/** Formats storefront order item variant_snapshot for display. */
export function formatVariantSnapshot(snapshot: unknown): string | null {
  if (!snapshot) return null

  if (Array.isArray(snapshot)) {
    const parts = snapshot
      .map((row) => {
        if (!row || typeof row !== 'object') return ''
        const attr = String((row as { attribute?: unknown }).attribute ?? '').trim()
        const opt = String((row as { option?: unknown }).option ?? '').trim()
        if (attr && opt) return `${attr}: ${opt}`
        return opt || attr
      })
      .filter(Boolean)
    return parts.length > 0 ? parts.join(' · ') : null
  }

  if (typeof snapshot === 'object') {
    const parts = Object.entries(snapshot as Record<string, unknown>)
      .filter(([, value]) => value != null && String(value).trim() !== '')
      .map(([key, value]) => `${key}: ${String(value).trim()}`)
    return parts.length > 0 ? parts.join(' · ') : null
  }

  return null
}

/** Prefer bare product name when variant is shown separately. */
export function orderItemDisplayName(nameSnapshot: string, variantLabel: string | null): string {
  if (!variantLabel) return nameSnapshot
  const trimmed = nameSnapshot.trim()
  const open = trimmed.lastIndexOf(' (')
  if (open > 0 && trimmed.endsWith(')')) {
    return trimmed.slice(0, open).trim() || nameSnapshot
  }
  return nameSnapshot
}
