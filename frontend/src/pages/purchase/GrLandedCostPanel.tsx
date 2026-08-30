import { formatRupiah } from '../../lib/money'
import { useI18n } from '../../i18n'

export type LandedCostDraft = {
  freight: string
  customs: string
  insurance: string
  other: string
  allocation_method: 'value' | 'qty'
}

export const emptyLandedCostDraft = (): LandedCostDraft => ({
  freight: '0',
  customs: '0',
  insurance: '0',
  other: '0',
  allocation_method: 'value',
})

export type LandedCostRow = {
  freight: number
  customs: number
  insurance: number
  other: number
  total_extra: number
  allocation_method: 'value' | 'qty'
  applied_at?: string | null
}

export function landedCostFromApi(row: LandedCostRow | null | undefined): LandedCostDraft {
  if (!row) return emptyLandedCostDraft()
  return {
    freight: String(row.freight ?? 0),
    customs: String(row.customs ?? 0),
    insurance: String(row.insurance ?? 0),
    other: String(row.other ?? 0),
    allocation_method: row.allocation_method === 'qty' ? 'qty' : 'value',
  }
}

export function landedCostPayload(draft: LandedCostDraft) {
  return {
    freight: Math.max(0, Number(draft.freight || 0)),
    customs: Math.max(0, Number(draft.customs || 0)),
    insurance: Math.max(0, Number(draft.insurance || 0)),
    other: Math.max(0, Number(draft.other || 0)),
    allocation_method: draft.allocation_method,
  }
}

export function hasLandedCostInput(draft: LandedCostDraft): boolean {
  return (
    Number(draft.freight || 0) > 0 ||
    Number(draft.customs || 0) > 0 ||
    Number(draft.insurance || 0) > 0 ||
    Number(draft.other || 0) > 0
  )
}

type Props = {
  draft: LandedCostDraft
  appliedAt?: string | null
  readOnly?: boolean
  locale: string
  onChange: (draft: LandedCostDraft) => void
}

export function GrLandedCostPanel({ draft, appliedAt, readOnly, locale, onChange }: Props) {
  const { t } = useI18n()
  const total =
    Number(draft.freight || 0) +
    Number(draft.customs || 0) +
    Number(draft.insurance || 0) +
    Number(draft.other || 0)

  function patch(partial: Partial<LandedCostDraft>) {
    onChange({ ...draft, ...partial })
  }

  return (
    <div className="rounded-2xl border border-line p-3">
      <div className="mb-2 text-sm font-medium text-fg">{t('procurementLandedCostPanel')}</div>
      {appliedAt ? (
        <p className="mb-3 text-xs text-muted">{t('procurementLandedCostApplied')}</p>
      ) : (
        <p className="mb-3 text-xs text-muted">{t('procurementLandedCostEnabledHint')}</p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {(['freight', 'customs', 'insurance', 'other'] as const).map((field) => (
          <label key={field} className="block text-sm text-muted">
            {t(
              field === 'freight'
                ? 'procurementLandedCostFreight'
                : field === 'customs'
                  ? 'procurementLandedCostCustoms'
                  : field === 'insurance'
                    ? 'procurementLandedCostInsurance'
                    : 'procurementLandedCostOther',
            )}
            <input
              type="number"
              min={0}
              className="field mt-1"
              value={draft[field]}
              disabled={readOnly}
              onChange={(e) => patch({ [field]: e.target.value })}
            />
          </label>
        ))}
        <label className="block text-sm text-muted sm:col-span-2">
          {t('procurementLandedCostAllocation')}
          <select
            className="field mt-1"
            value={draft.allocation_method}
            disabled={readOnly}
            onChange={(e) => patch({ allocation_method: e.target.value as 'value' | 'qty' })}
          >
            <option value="value">{t('procurementLandedCostAllocationValue')}</option>
            <option value="qty">{t('procurementLandedCostAllocationQty')}</option>
          </select>
        </label>
      </div>
      <div className="mt-3 text-sm text-muted">
        {t('procurementLandedCostTotal')}: <span className="font-medium text-fg">{formatRupiah(total, locale)}</span>
      </div>
    </div>
  )
}
