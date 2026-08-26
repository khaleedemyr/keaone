import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ReceiptPaper } from './ReceiptPaper'
import { SettlementPaper } from './SettlementPaper'
import type { PosSettlement, ReceiptPayload } from '../types'
import { useI18n } from '../i18n'

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow?: string
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow ? (
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-mint/80">
            {eyebrow}
          </div>
        ) : null}
        <h1 className="font-display text-3xl font-bold tracking-tight text-fg">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  )
}

export function ReceiptModal({
  receipt,
  onClose,
}: {
  receipt: ReceiptPayload | null
  onClose: () => void
}) {
  const { t } = useI18n()
  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {receipt ? (
        <div className="receipt-root">
          <motion.div
            className="receipt-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="receipt-dialog"
            initial={{ y: 24, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 16, opacity: 0 }}
          >
            <ReceiptPaper receipt={receipt} layout={receipt.layout} />
            <div className="receipt-actions">
              <button type="button" className="btn-ghost" onClick={onClose}>
                {t('close')}
              </button>
              <button type="button" className="btn-primary" onClick={() => window.print()}>
                {t('print')}
              </button>
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}

export function SettlementModal({
  data,
  onClose,
}: {
  data: PosSettlement | null
  onClose: () => void
}) {
  const { t } = useI18n()
  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {data ? (
        <div className="receipt-root">
          <motion.div
            className="receipt-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="receipt-dialog"
            initial={{ y: 24, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 16, opacity: 0 }}
          >
            <SettlementPaper data={data} />
            <div className="receipt-actions">
              <button type="button" className="btn-ghost" onClick={onClose}>
                {t('close')}
              </button>
              <button type="button" className="btn-primary" onClick={() => window.print()}>
                {t('print')}
              </button>
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}
