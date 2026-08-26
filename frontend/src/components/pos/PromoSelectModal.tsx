import { useEffect, useState } from 'react'
import type { Promotion } from '../../types'
import { useI18n } from '../../i18n'
import { PosListModal } from './PosListModal'
import { VirtualKeyboard } from './VirtualKeyboard'

export function PromoSelectModal({
  open,
  promotions,
  value,
  onSelect,
  onClose,
  formatLabel,
  promoCode = '',
  onPromoCodeChange,
  onApplyPromoCode,
}: {
  open: boolean
  promotions: Promotion[]
  value: number | ''
  onSelect: (value: number | '') => void
  onClose: () => void
  formatLabel: (item: Promotion) => string
  promoCode?: string
  onPromoCodeChange?: (value: string) => void
  onApplyPromoCode?: (code: string) => void
}) {
  const { t } = useI18n()
  const [codeDraft, setCodeDraft] = useState(promoCode)

  useEffect(() => {
    if (open) setCodeDraft(promoCode)
  }, [open, promoCode])

  const options = [
    { id: '' as const, label: t('posNoPromo') },
    ...promotions.map((item) => ({ id: item.id as number, label: formatLabel(item) })),
  ]

  function setCode(next: string) {
    const normalized = next.toUpperCase().replace(/[^A-Z0-9-_]/g, '').slice(0, 32)
    setCodeDraft(normalized)
    onPromoCodeChange?.(normalized)
  }

  function applyCode() {
    const code = codeDraft.trim().toUpperCase()
    onPromoCodeChange?.(code)
    onApplyPromoCode?.(code)
    onClose()
  }

  return (
    <PosListModal
      open={open}
      title={t('posPromoListTitle')}
      hint={t('posPromoListHint')}
      emptyLabel={t('posPromoEmpty')}
      options={options}
      value={value}
      onSelect={onSelect}
      onClose={onClose}
      footer={
        onPromoCodeChange && onApplyPromoCode ? (
          <div className="space-y-3 border-t border-line px-4 py-3">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{t('posPromoCode')}</div>
            <div className="flex gap-2" data-pos-list-code="1">
              <input
                className="field min-h-12 flex-1 text-base uppercase tracking-wide"
                value={codeDraft}
                onChange={(event) => setCode(event.target.value)}
                onFocus={() => setCodeDraft(promoCode)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    event.stopPropagation()
                    applyCode()
                  }
                }}
                placeholder={t('promoCodeHint')}
                inputMode="none"
              />
              <button type="button" className="btn-primary min-h-12 shrink-0 px-4" onClick={applyCode}>
                {t('posPromoCodeApply')}
              </button>
            </div>
            <VirtualKeyboard
              onKey={(key) => setCode(`${codeDraft}${key}`)}
              onBackspace={() => setCode(codeDraft.slice(0, -1))}
              onClear={() => setCode('')}
              onEnter={applyCode}
              enterLabel={t('posPromoCodeApply')}
            />
          </div>
        ) : null
      }
    />
  )
}
