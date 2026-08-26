import type { Discount } from '../../types'

function chipClass(active: boolean, compact = false) {
  return [
    'rounded-xl text-left transition',
    compact ? 'px-2.5 py-2 text-xs' : 'px-3 py-2 text-sm',
    active ? 'bg-mint font-semibold text-ink' : 'bg-fill text-muted hover:text-fg',
  ].join(' ')
}

export function DiscountPicker({
  label,
  discounts,
  value,
  onChange,
  noDiscountLabel,
  formatLabel,
  compact = false,
}: {
  label: string
  discounts: Discount[]
  value: number | ''
  onChange: (value: number | '') => void
  noDiscountLabel: string
  formatLabel: (item: Discount) => string
  compact?: boolean
}) {
  if (discounts.length === 0) return null

  return (
    <div>
      <div className={`mb-2 font-medium uppercase tracking-[0.14em] text-muted ${compact ? 'text-[10px]' : 'text-xs'}`}>
        {label}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={chipClass(value === '', compact)} onClick={() => onChange('')}>
          {noDiscountLabel}
        </button>
        {discounts.map((item) => (
          <button
            key={item.id}
            type="button"
            className={chipClass(value === item.id, compact)}
            onClick={() => onChange(item.id)}
          >
            {formatLabel(item)}
          </button>
        ))}
      </div>
    </div>
  )
}
