import type { Discount } from '../../types'
import { useI18n } from '../../i18n'
import { PosListModal } from './PosListModal'

export function DiscountSelectModal({
  open,
  discounts,
  value,
  onSelect,
  onClose,
  formatLabel,
}: {
  open: boolean
  discounts: Discount[]
  value: number | ''
  onSelect: (value: number | '') => void
  onClose: () => void
  formatLabel: (item: Discount) => string
}) {
  const { t } = useI18n()
  const options = [
    { id: '' as const, label: t('posNoDiscount') },
    ...discounts.map((item) => ({ id: item.id as number, label: formatLabel(item) })),
  ]

  return (
    <PosListModal
      open={open}
      title={t('posDiscountListTitle')}
      hint={t('posDiscountListHint')}
      emptyLabel={t('posDiscountEmpty')}
      options={options}
      value={value}
      onSelect={onSelect}
      onClose={onClose}
    />
  )
}
