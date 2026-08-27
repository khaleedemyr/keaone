import { api } from './client'

export type BlogTranslation = {
  locale: string
  title: string
  slug: string
  excerpt: string | null
  body: string | null
}

export type AdminBlogPost = {
  id: number
  status: 'draft' | 'published'
  published_at: string | null
  cover: string | null
  cover_path: string | null
  author: { id: number; name: string; email: string } | null
  translations: BlogTranslation[]
  updated_at: string | null
  created_at: string | null
}

type Ok<T> = { data: T; meta?: { current_page?: number; last_page?: number; total?: number; per_page?: number } }

export async function listPlatformBlog(params?: {
  search?: string
  status?: string
  page?: number
  per_page?: number
}) {
  const { data } = await api.get<Ok<AdminBlogPost[]>>('/platform/blog-posts', { params })
  return { rows: Array.isArray(data.data) ? data.data : [], meta: data.meta ?? {} }
}

export async function getPlatformBlog(id: number) {
  const { data } = await api.get<Ok<AdminBlogPost>>(`/platform/blog-posts/${id}`)
  return data.data
}

export async function savePlatformBlog(
  payload: {
    status: 'draft' | 'published'
    published_at?: string | null
    translations: BlogTranslation[]
  },
  id?: number,
) {
  if (id) {
    const { data } = await api.put<Ok<AdminBlogPost>>(`/platform/blog-posts/${id}`, payload)
    return data.data
  }
  const { data } = await api.post<Ok<AdminBlogPost>>('/platform/blog-posts', payload)
  return data.data
}

export async function deletePlatformBlog(id: number) {
  await api.delete(`/platform/blog-posts/${id}`)
}

export async function uploadBlogCover(id: number, file: File) {
  const body = new FormData()
  body.append('file', file)
  const { data } = await api.post<Ok<AdminBlogPost>>(`/platform/blog-posts/${id}/cover`, body, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data.data
}

export async function uploadBlogMedia(id: number, file: File) {
  const body = new FormData()
  body.append('file', file)
  const { data } = await api.post<Ok<{ url: string }>>(`/platform/blog-posts/${id}/media`, body, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data.data
}
