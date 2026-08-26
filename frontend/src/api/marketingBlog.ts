import { api } from './client'

export type MarketingBlogPost = {
  id: number
  slug: string
  locale: string
  title: string
  excerpt: string | null
  cover: string | null
  published_at: string | null
  body?: string
  related?: MarketingBlogPost[]
}

type Ok<T> = { data: T }

export async function listMarketingBlog(lang: string, limit = 12) {
  const { data } = await api.get<Ok<MarketingBlogPost[]>>('/marketing/blog', {
    params: { lang, limit },
    silent: true,
  })
  return Array.isArray(data.data) ? data.data : []
}

export async function getMarketingBlog(slug: string, lang: string) {
  const { data } = await api.get<Ok<MarketingBlogPost>>(`/marketing/blog/${encodeURIComponent(slug)}`, {
    params: { lang },
    silent: true,
  })
  return data.data
}
