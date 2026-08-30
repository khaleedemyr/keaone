import { useState } from 'react'
import type { KeyboardEvent } from 'react'
import { apiMessage } from '../../api/client'
import { useFeedback } from '../../components/feedback'
import { useI18n } from '../../i18n'
import { ProcurementBarcodeScanner } from './ProcurementBarcodeScanner'
import { lookupPoForGr, parsePoScanPayload } from './poScan'

function CameraScanButton({ onClick }: { onClick: () => void }) {
  const { t } = useI18n()
  return (
    <button
      type="button"
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line bg-fill text-fg active:bg-fill/80"
      title={t('procurementPoScanCamera')}
      aria-label={t('procurementPoScanCamera')}
      onClick={onClick}
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4 8h2l1.5-2h9L18 8h2a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z"
        />
        <circle cx="12" cy="13" r="3.5" />
      </svg>
    </button>
  )
}

export function PoGrScanField({
  disabled,
  selectedPoNumber,
  onPoLoaded,
}: {
  disabled?: boolean
  selectedPoNumber?: string
  onPoLoaded: (poId: string) => void | Promise<void>
}) {
  const { t } = useI18n()
  const feedback = useFeedback()
  const [query, setQuery] = useState('')
  const [scannerOpen, setScannerOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function resolveScan(raw: string) {
    const payload = parsePoScanPayload(raw)
    if (!payload.poId && !payload.number) return

    setLoading(true)
    try {
      const po = await lookupPoForGr(payload)
      if (!po) {
        feedback.error(t('procurementPoScanNotFound'))
        return
      }
      await onPoLoaded(String(po.id))
      setQuery(po.number)
      feedback.success(t('procurementPoScanLoaded', { number: po.number }))
    } catch (err) {
      feedback.error(apiMessage(err, t('procurementPoScanNotFound')))
    } finally {
      setLoading(false)
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    void resolveScan(query)
  }

  return (
    <div className="rounded-2xl border border-line bg-fill/20 p-3">
      <div className="mb-1 text-sm font-medium text-fg">{t('purchaseFromPo')}</div>
      <div className="mb-2 text-[11px] text-muted">{t('procurementPoScanHint')}</div>
      <div className="flex items-center gap-2">
        <input
          type="search"
          className="field !mt-0 min-w-0 flex-1 text-base"
          placeholder={t('procurementPoScanPlaceholder')}
          value={query}
          disabled={disabled || loading}
          autoComplete="off"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <CameraScanButton onClick={() => setScannerOpen(true)} />
      </div>
      {selectedPoNumber ? (
        <div className="mt-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-sm text-fg">
          {t('procurementPoScanActive', { number: selectedPoNumber })}
        </div>
      ) : null}

      <ProcurementBarcodeScanner
        open={scannerOpen && !disabled}
        onClose={() => setScannerOpen(false)}
        onScan={(code) => {
          void resolveScan(code)
        }}
      />
    </div>
  )
}
