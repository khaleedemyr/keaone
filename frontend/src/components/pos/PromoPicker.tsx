import type { Promotion } from '../../types'

function chipClass(active: boolean, compact = false) {
  return [
    'rounded-xl text-left transition',
    compact ? 'px-2.5 py-2 text-xs' : 'px-3 py-2 text-sm',
    active ? 'bg-mint font-semibold text-ink' : 'bg-fill text-muted hover:text-fg',
  ].join(' ')
}

export function PromoPicker({
  label,
  promotions,
  value,
  onChange,
  noPromoLabel,
  formatLabel,
  compact = false,
}: {
  label: string
  promotions: Promotion[]
  value: number | ''
  onChange: (value: number | '') => void
  noPromoLabel: string
  formatLabel: (item: Promotion) => string
  compact?: boolean
}) {
  if (promotions.length === 0) return null

  return (
    <div>
      <div className={`mb-2 font-medium uppercase tracking-[0.14em] text-muted ${compact ? 'text-[10px]' : 'text-xs'}`}>
        {label}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={chipClass(value === '', compact)} onClick={() => onChange('')}>
          {noPromoLabel}
        </button>
        {promotions.map((item) => (
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
