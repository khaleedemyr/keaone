export type PosPayMethod = 'cash' | 'transfer' | 'qris'

export type PosTenderRow = {
  id: string
  method: PosPayMethod
  amount: string
}

export type SalePaymentPayload = {
  method: PosPayMethod
  amount: number
  client_uuid: string
}

export function newTenderRow(method: PosPayMethod = 'transfer', amount = ''): PosTenderRow {
  return {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `t-${Date.now()}-${Math.random()}`,
    method,
    amount,
  }
}

export function tenderAmount(row: PosTenderRow): number {
  const n = Number(row.amount)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}

export function sumTenders(rows: PosTenderRow[]): number {
  return rows.reduce((sum, row) => sum + tenderAmount(row), 0)
}

/**
 * Build payments for POST /sales from single-method or split tender UI.
 */
export function buildSalePayments(input: {
  split: boolean
  method: PosPayMethod
  payAmount: string
  tenders: PosTenderRow[]
  total: number
  clientUuid: string
}):
  | { ok: true; payments: SalePaymentPayload[]; paid: number; change: number }
  | { ok: false; error: 'underpay' | 'empty' | 'noncash_over' | 'invalid' } {
  const total = Math.max(0, Math.floor(input.total))

  if (!input.split) {
    const pay = Math.floor(Number(input.payAmount) || 0)
    if (input.method === 'cash' && pay > 0 && pay < total) {
      return { ok: false, error: 'underpay' }
    }
    const amount = input.method === 'cash' ? Math.max(pay, total) : total
    if (amount < 1 && total > 0) {
      return { ok: false, error: 'empty' }
    }
    const payments: SalePaymentPayload[] = [
      { method: input.method, amount: amount || total, client_uuid: `${input.clientUuid}-p0` },
    ]
    const paid = payments[0].amount
    return { ok: true, payments, paid, change: Math.max(0, paid - total) }
  }

  const rows = input.tenders.filter((row) => tenderAmount(row) > 0)
  if (rows.length === 0) {
    return { ok: false, error: 'empty' }
  }

  let remaining = total
  const payments: SalePaymentPayload[] = []
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    let amount = tenderAmount(row)
    if (row.method !== 'cash') {
      if (amount > remaining) {
        return { ok: false, error: 'noncash_over' }
      }
    }
    payments.push({
      method: row.method,
      amount,
      client_uuid: `${input.clientUuid}-p${i}`,
    })
    remaining = Math.max(0, remaining - amount)
  }

  const paid = payments.reduce((sum, p) => sum + p.amount, 0)
  if (paid < total) {
    return { ok: false, error: 'underpay' }
  }

  return { ok: true, payments, paid, change: Math.max(0, paid - total) }
}
