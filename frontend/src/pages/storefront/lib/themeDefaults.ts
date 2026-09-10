import type { StorefrontTemplateSlot, StorefrontThemeContent } from '../types'

/** Slot text defaults for empty form fields / preview fallbacks. */
export function themeDefaultsFromSlots(slots: StorefrontTemplateSlot[]): StorefrontThemeContent {
  const out: StorefrontThemeContent = {}
  for (const slot of slots) {
    if (slot.default == null || String(slot.default).trim() === '') continue
    if (slot.type === 'text' || slot.type === 'textarea' || slot.type === 'select') {
      out[slot.key] = slot.default
    }
  }
  return out
}

/** Defaults first, then saved values (including images). */
export function mergeThemeContent(
  slots: StorefrontTemplateSlot[],
  saved?: StorefrontThemeContent | null,
): StorefrontThemeContent {
  return { ...themeDefaultsFromSlots(slots), ...(saved ?? {}) }
}

function isMediaSlot(slot: StorefrontTemplateSlot | undefined, key: string): boolean {
  if (slot?.type === 'image' || slot?.type === 'gallery') return true
  return /(_image|_gallery|logo)/i.test(key)
}

/**
 * On template switch: use the new template’s text defaults.
 * Only keep previous media so old nav/hero copy cannot target missing section ids
 * (e.g. Ellipse `#awards` left over on Prompt).
 */
export function themeForTemplateSwitch(
  slots: StorefrontTemplateSlot[],
  previous: StorefrontThemeContent,
): StorefrontThemeContent {
  const defaults = themeDefaultsFromSlots(slots)
  const byKey = new Map(slots.map((s) => [s.key, s]))
  const next: StorefrontThemeContent = { ...defaults }
  for (const [key, value] of Object.entries(previous)) {
    if (!byKey.has(key) || value == null) continue
    if (typeof value === 'string' && value.trim() === '') continue
    if (Array.isArray(value) && value.length === 0) continue
    if (!isMediaSlot(byKey.get(key), key)) continue
    next[key] = value
  }
  return next
}
