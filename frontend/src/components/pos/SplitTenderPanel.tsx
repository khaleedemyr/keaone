import { useI18n } from '../../i18n'
import { formatRupiah } from '../../lib/money'
import { newTenderRow, sumTenders, type PosPayMethod, type PosTenderRow } from '../../lib/posTender'

type Props = {
  total: number
  rows: PosTenderRow[]
  onChange: (rows: PosTenderRow[]) => void
  /** Compact styling for retail register */
  compact?: boolean
}

const METHODS: PosPayMethod[] = ['cash', 'transfer', 'qris']

export function SplitTenderPanel({ total, rows, onChange, compact }: Props) {
  const { t, locale } = useI18n()
  const paid = sumTenders(rows)
  const remaining = Math.max(0, total - paid)
  const change = Math.max(0, paid - total)

  function patch(id: string, patch: Partial<PosTenderRow>) {
    onChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }

  function remove(id: string) {
    if (rows.length <= 1) return
    onChange(rows.filter((row) => row.id !== id))
  }

  function addRow() {
    if (rows.length >= 3) return
    const nextMethod: PosPayMethod = remaining > 0 ? 'transfer' : 'cash'
    onChange([...rows, newTenderRow(nextMethod, remaining > 0 ? String(remaining) : '')])
  }

  function fillRemaining(id: string) {
    if (remaining <= 0) return
    const row = rows.find((r) => r.id === id)
    if (!row) return
    const current = Number(row.amount) || 0
    patch(id, { amount: String(current + remaining) })
  }

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      <div className={`flex flex-wrap items-center justify-between gap-2 ${compact ? 'text-xs' : 'text-sm'}`}>
        <span className="text-muted">{t('posSplitRemaining')}</span>
        <span className={`font-medium tabular-nums ${remaining > 0 ? 'text-amber-300' : 'text-mint'}`}>
          {formatRupiah(remaining, locale)}
        </span>
      </div>

      {rows.map((row, index) => (
        <div key={row.id} className={`rounded-xl border border-white/10 bg-fill/40 ${compact ? 'p-2' : 'p-3'} space-y-2`}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted">
              {t('posSplitRow')} {index + 1}
            </span>
            {rows.length > 1 ? (
              <button type="button" className="text-xs text-rose-300" onClick={() => remove(row.id)}>
                {t('posSplitRemove')}
              </button>
            ) : null}
          </div>
          <div className={`flex gap-1 ${compact ? '' : 'gap-2'}`}>
            {METHODS.map((method) => (
              <button
                key={method}
                type="button"
                onClick={() => patch(row.id, { method })}
                className={`flex-1 rounded-lg px-1 py-1.5 text-xs ${
                  row.method === method ? 'bg-mint text-ink font-semibold' : 'bg-fill text-muted'
                }`}
              >
                {method === 'cash' ? t('cash') : method === 'transfer' ? t('transfer') : t('qris')}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="number"
              min={0}
              className={`field flex-1 tabular-nums ${compact ? 'min-h-10 text-sm' : ''}`}
              placeholder={t('posSplitAmount')}
              value={row.amount}
              onChange={(e) => patch(row.id, { amount: e.target.value })}
            />
            {remaining > 0 ? (
              <button type="button" className="btn-ghost shrink-0 text-xs" onClick={() => fillRemaining(row.id)}>
                {t('posSplitFillRest')}
              </button>
            ) : null}
          </div>
        </div>
      ))}

      {rows.length < 3 ? (
        <button type="button" className="btn-ghost w-full text-sm" onClick={addRow}>
          {t('posSplitAdd')}
        </button>
      ) : null}

      {change > 0 ? (
        <div className={`flex justify-between ${compact ? 'text-sm' : 'text-sm'}`}>
          <span className="text-muted">{t('change')}</span>
          <span className="font-display font-bold text-mint tabular-nums">{formatRupiah(change, locale)}</span>
        </div>
      ) : null}
    </div>
  )
}
