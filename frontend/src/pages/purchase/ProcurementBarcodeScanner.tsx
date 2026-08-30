import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode'
import { useI18n } from '../../i18n'

const REGION_ID = 'procurement-barcode-scanner-region'

const BARCODE_FORMATS = [
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.ITF,
  Html5QrcodeSupportedFormats.QR_CODE,
]

export function ProcurementBarcodeScanner({
  open,
  onClose,
  onScan,
}: {
  open: boolean
  onClose: () => void
  onScan: (code: string) => void
}) {
  const { t } = useI18n()
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) {
      setError('')
      return
    }

    let scanner: Html5Qrcode | null = null
    let handled = false
    let cancelled = false

    const timer = window.setTimeout(() => {
      void (async () => {
        if (cancelled || !document.getElementById(REGION_ID)) return

        scanner = new Html5Qrcode(REGION_ID, {
          formatsToSupport: BARCODE_FORMATS,
          verbose: false,
        })

        try {
          await scanner.start(
            { facingMode: 'environment' },
            {
              fps: 10,
              qrbox: (viewfinderWidth, viewfinderHeight) => ({
                width: Math.min(Math.floor(viewfinderWidth * 0.88), 340),
                height: Math.min(Math.floor(viewfinderHeight * 0.38), 150),
              }),
            },
            (decodedText) => {
              if (handled || cancelled) return
              handled = true
              onScan(decodedText.trim())
              onClose()
            },
            () => {},
          )
        } catch {
          if (!cancelled) {
            setError(t('procurementCameraPermission'))
          }
        }
      })()
    }, 80)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
      void (async () => {
        if (!scanner) return
        try {
          if (scanner.isScanning) {
            await scanner.stop()
          }
          scanner.clear()
        } catch {
          // ignore cleanup errors
        }
      })()
    }
  }, [open, onClose, onScan, t])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-[110] flex flex-col bg-black text-white">
      <div className="flex shrink-0 items-start justify-between gap-3 px-4 pb-2 pt-4">
        <div className="min-w-0">
          <div className="font-semibold">{t('procurementScanCamera')}</div>
          <div className="text-xs text-white/70">{t('procurementScanCameraHint')}</div>
        </div>
        <button type="button" className="btn-ghost shrink-0 !px-3 !text-white" onClick={onClose}>
          {t('close')}
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-3 pb-6">
        <div
          id={REGION_ID}
          className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/15 bg-black [&_video]:rounded-2xl"
        />
        {error ? <p className="mt-4 max-w-md text-center text-sm text-rose-300">{error}</p> : null}
      </div>
    </div>,
    document.body,
  )
}
