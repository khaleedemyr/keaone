/** Payload embedded in PO QR codes for goods receipt scanning. */
export function buildPoQrPayload(po: { id: number; number: string }) {
  return `keaone:po:${po.id}:${po.number}`
}

export type PoScanPayload = {
  poId?: number
  number?: string
}

/** Parse raw scan text from PO QR (new format or legacy number-only). */
export function parsePoScanPayload(raw: string): PoScanPayload {
  const trimmed = raw.trim()
  if (!trimmed) return {}

  const keaMatch = /^keaone:po:(\d+)(?::(.+))?$/i.exec(trimmed)
  if (keaMatch) {
    return {
      poId: Number(keaMatch[1]) || undefined,
      number: keaMatch[2]?.trim() || undefined,
    }
  }

  return { number: trimmed }
}

import type { ApiOk } from '../../types'

export type PoLookupRow = {
  id: number
  number: string
  status: string
  supplier?: { id: number; name: string } | null
  warehouse?: { id: number; name: string } | null
}

export async function lookupPoForGr(payload: PoScanPayload): Promise<PoLookupRow | null> {
  const { api } = await import('../../api/client')
  const { data } = await api.get<ApiOk<PoLookupRow>>('/purchase-orders/lookup', {
    params: {
      id: payload.poId || undefined,
      number: payload.poId ? undefined : payload.number || undefined,
    },
    silent: true,
  })
  return data.data ?? null
}
