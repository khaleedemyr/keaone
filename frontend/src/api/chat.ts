import { api } from './client'

export type ChatUser = {
  id: number
  name: string
  email?: string | null
  username?: string | null
  avatar?: string | null
}

export type ChatMessage = {
  id: number
  conversation_id: number
  user_id: number
  body: string
  created_at: string | null
  user: ChatUser | null
}

export type ChatConversation = {
  id: number
  type: string
  title: string | null
  peer: ChatUser | null
  last_message: ChatMessage | null
  last_message_at: string | null
  unread_count: number
}

type Ok<T> = { data: T }

export async function listPeers(search = '') {
  const { data } = await api.get<Ok<ChatUser[]>>('/chat/peers', {
    params: search ? { search } : undefined,
    silent: true,
  })
  return data.data
}

export async function listConversations() {
  const { data } = await api.get<Ok<ChatConversation[]>>('/chat/conversations', { silent: true })
  return data.data
}

export async function openDirect(userId: number) {
  const { data } = await api.post<Ok<ChatConversation>>('/chat/conversations', { user_id: userId })
  return data.data
}

export async function listMessages(conversationId: number, opts?: { afterId?: number; beforeId?: number; limit?: number }) {
  const { data } = await api.get<Ok<ChatMessage[]>>(`/chat/conversations/${conversationId}/messages`, {
    params: {
      after_id: opts?.afterId || undefined,
      before_id: opts?.beforeId || undefined,
      limit: opts?.limit || 50,
    },
    silent: true,
  })
  return data.data
}

export async function sendMessage(conversationId: number, body: string) {
  const { data } = await api.post<Ok<ChatMessage>>(`/chat/conversations/${conversationId}/messages`, { body })
  return data.data
}

export async function markRead(conversationId: number) {
  await api.post(`/chat/conversations/${conversationId}/read`, {}, { silent: true })
}
