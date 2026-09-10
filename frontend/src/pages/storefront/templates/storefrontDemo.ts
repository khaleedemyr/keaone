/** Demo stock content is for admin preview only — never on the public live site. */
export function allowStorefrontDemo(model: { preview?: boolean | null }): boolean {
  return Boolean(model.preview)
}

/** Prefer real items; only fall back to demo arrays while previewing. */
export function withDemoFallback<T>(
  model: { preview?: boolean | null },
  real: T[],
  demo: T[],
): T[] {
  if (real.length > 0) return real
  return allowStorefrontDemo(model) ? demo : []
}

/** Prefer uploaded media; demo URL only in preview. */
export function withDemoImage(
  model: { preview?: boolean | null },
  uploaded: string | null | undefined,
  demoUrl: string,
): string | undefined {
  const src = typeof uploaded === 'string' ? uploaded.trim() : ''
  if (src) return src
  return allowStorefrontDemo(model) ? demoUrl : undefined
}
