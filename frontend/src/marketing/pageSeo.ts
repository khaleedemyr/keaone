import { useEffect } from 'react'

const MANAGED = 'data-kea-seo'

export type PageSeoOptions = {
  title: string
  description?: string
  keywords?: string
  path?: string
  image?: string
  type?: string
  noindex?: boolean
  jsonLd?: object | object[]
}

function siteOrigin() {
  return typeof window !== 'undefined' ? window.location.origin : ''
}

function upsertMeta(
  tag: 'meta' | 'link',
  attrs: Record<string, string>,
  content?: string,
) {
  const selector =
    tag === 'link'
      ? `link[${MANAGED}][rel="${attrs.rel}"]`
      : `meta[${MANAGED}][${attrs.name ? `name="${attrs.name}"` : `property="${attrs.property}"`}]`
  let el = document.head.querySelector(selector) as HTMLMetaElement | HTMLLinkElement | null
  if (!el) {
    el = document.createElement(tag)
    el.setAttribute(MANAGED, '')
    for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value)
    document.head.appendChild(el)
  }
  if (content !== undefined) {
    if (tag === 'link') (el as HTMLLinkElement).href = content
    else (el as HTMLMetaElement).content = content
  }
}

function upsertJsonLd(data: object | object[]) {
  const id = 'kea-seo-jsonld'
  let el = document.getElementById(id) as HTMLScriptElement | null
  if (!el) {
    el = document.createElement('script')
    el.id = id
    el.type = 'application/ld+json'
    el.setAttribute(MANAGED, '')
    document.head.appendChild(el)
  }
  el.textContent = JSON.stringify(data)
}

export function applyPageSeo(opts: PageSeoOptions) {
  document.title = opts.title

  const origin = siteOrigin()
  const url = opts.path ? `${origin}${opts.path}` : window.location.href.split('#')[0]
  const image = opts.image ?? `${origin}/marketing/desktop.png`
  const type = opts.type ?? 'website'

  upsertMeta('meta', { name: 'robots' }, opts.noindex ? 'noindex, nofollow' : 'index, follow')

  if (opts.description) {
    upsertMeta('meta', { name: 'description' }, opts.description)
    upsertMeta('meta', { property: 'og:description' }, opts.description)
    upsertMeta('meta', { name: 'twitter:description' }, opts.description)
  }

  if (opts.keywords) {
    upsertMeta('meta', { name: 'keywords' }, opts.keywords)
  }

  upsertMeta('meta', { property: 'og:title' }, opts.title)
  upsertMeta('meta', { name: 'twitter:title' }, opts.title)
  upsertMeta('meta', { property: 'og:type' }, type)
  upsertMeta('meta', { property: 'og:url' }, url)
  upsertMeta('meta', { property: 'og:site_name' }, 'KEA One')
  upsertMeta('meta', { property: 'og:image' }, image)
  upsertMeta('meta', { name: 'twitter:card' }, 'summary_large_image')
  upsertMeta('meta', { name: 'twitter:image' }, image)
  upsertMeta('link', { rel: 'canonical' }, url)

  if (opts.jsonLd) upsertJsonLd(opts.jsonLd)
}

export function usePageSeo(opts: PageSeoOptions) {
  useEffect(() => {
    applyPageSeo(opts)
  }, [
    opts.title,
    opts.description,
    opts.keywords,
    opts.path,
    opts.image,
    opts.type,
    opts.noindex,
    opts.jsonLd,
  ])
}
