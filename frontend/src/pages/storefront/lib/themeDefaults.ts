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

/** Keep only keys allowed by the new template; fill missing text from defaults. */
export function themeForTemplateSwitch(
  slots: StorefrontTemplateSlot[],
  previous: StorefrontThemeContent,
): StorefrontThemeContent {
  const defaults = themeDefaultsFromSlots(slots)
  const next: StorefrontThemeContent = { ...defaults }
  const allowed = new Set(slots.map((s) => s.key))
  for (const [key, value] of Object.entries(previous)) {
    if (!allowed.has(key) || value == null) continue
    if (typeof value === 'string' && value.trim() === '') continue
    if (Array.isArray(value) && value.length === 0) continue
    next[key] = value
  }
  return next
}
