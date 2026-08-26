import type { FormEvent, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { FormAlert } from './feedback'
import { useI18n } from '../i18n'

export function MasterModal({
  open,
  title,
  error,
  saving,
  onClose,
  onSubmit,
  onInvalid,
  children,
  tabs,
  wide,
  size,
}: {
  open: boolean
  title: string
  error: string
  saving: boolean
  onClose: () => void
  onSubmit: (event: FormEvent) => void
  onInvalid?: (event: FormEvent<HTMLFormElement>) => void
  children: ReactNode
  tabs?: ReactNode
  wide?: boolean
  size?: 'md' | 'lg' | 'xl' | '2xl'
}) {
  const { t } = useI18n()
  const width = size === '2xl' ? 'max-w-3xl' : size === 'xl' ? 'max-w-2xl' : size === 'lg' || wide ? 'max-w-lg' : 'max-w-md'

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose()
          }}
        >
          <motion.form
            onSubmit={(event) => void onSubmit(event)}
            onInvalidCapture={onInvalid}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className={`glass flex max-h-[min(90vh,720px)] w-full flex-col overflow-hidden rounded-3xl ${width}`}
          >
            <div className="shrink-0 px-6 pt-6">
              <h2 className="font-display text-xl font-bold">{title}</h2>
              {error ? <div className="mt-3"><FormAlert>{error}</FormAlert></div> : null}
              {tabs ? <div className="mt-4">{tabs}</div> : null}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4">
              <div className="grid gap-3">{children}</div>
            </div>
            <div className="flex shrink-0 justify-end gap-2 border-t border-line px-6 py-4">
              <button type="button" className="btn-ghost" onClick={onClose}>
                {t('cancel')}
              </button>
              <button type="submit" disabled={saving} className="btn-primary">
                {t('save')}
              </button>
            </div>
          </motion.form>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}

export function MasterViewModal({
  open,
  title,
  onClose,
  onEdit,
  children,
  size,
}: {
  open: boolean
  title: string
  onClose: () => void
  onEdit?: () => void
  children: ReactNode
  size?: 'md' | 'lg' | 'xl' | '2xl'
}) {
  const { t } = useI18n()
  const width = size === '2xl' ? 'max-w-3xl' : size === 'xl' ? 'max-w-2xl' : size === 'lg' ? 'max-w-lg' : 'max-w-md'

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose()
          }}
        >
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className={`glass flex max-h-[min(90vh,720px)] w-full flex-col overflow-hidden rounded-3xl ${width}`}
          >
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-6">
              <h2 className="font-display mb-4 text-xl font-bold">{title}</h2>
              <div className="grid gap-3">{children}</div>
            </div>
            <div className="flex shrink-0 justify-end gap-2 border-t border-line px-6 py-4">
              <button type="button" className="btn-ghost" onClick={onClose}>
                {t('close')}
              </button>
              {onEdit ? (
                <button type="button" className="btn-primary" onClick={onEdit}>
                  {t('edit')}
                </button>
              ) : null}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}

export function MasterNameButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" className="text-left font-medium text-fg hover:text-mint" onClick={onClick}>
      {children}
    </button>
  )
}

export function ViewField({ label, value }: { label: string; value?: string | number | null }) {
  const text = value === 0 || value ? String(value) : '-'
  return (
    <div>
      <div className="text-sm text-muted">{label}</div>
      <div className="text-fg">{text === '' ? '-' : text}</div>
    </div>
  )
}
