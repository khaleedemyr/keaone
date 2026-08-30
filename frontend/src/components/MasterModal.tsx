import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { FormAlert } from './feedback'
import { useI18n } from '../i18n'

function ModalWindowControls({
  maximized,
  minimized,
  onClose,
  onMinimize,
  onMaximize,
}: {
  maximized: boolean
  minimized: boolean
  onClose: () => void
  onMinimize: () => void
  onMaximize: () => void
}) {
  const { t } = useI18n()
  return (
    <div className="os-traffic shrink-0" onMouseDown={(e) => e.stopPropagation()}>
      <button type="button" className="os-dot os-dot-close" title={t('close')} aria-label={t('close')} onClick={onClose}>
        <svg viewBox="0 0 12 12" aria-hidden>
          <path d="M3 3l6 6M9 3L3 9" />
        </svg>
      </button>
      <button
        type="button"
        className="os-dot os-dot-min"
        title={minimized ? t('restore') : t('minimize')}
        aria-label={minimized ? t('restore') : t('minimize')}
        onClick={onMinimize}
      >
        <svg viewBox="0 0 12 12" aria-hidden>
          <path d="M2.5 6h7" />
        </svg>
      </button>
      <button
        type="button"
        className="os-dot os-dot-max"
        title={maximized ? t('restore') : t('maximize')}
        aria-label={maximized ? t('restore') : t('maximize')}
        onClick={onMaximize}
      >
        {maximized ? (
          <svg viewBox="0 0 12 12" aria-hidden>
            <path d="M4 4.5h4.5V9H4zM3.5 3h4.5v1" />
          </svg>
        ) : (
          <svg viewBox="0 0 12 12" aria-hidden>
            <rect x="2.75" y="2.75" width="6.5" height="6.5" rx="0.6" />
          </svg>
        )}
      </button>
    </div>
  )
}

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
  defaultMaximized,
  mobileFullscreen,
  submitLabel,
  submitDisabled,
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
  defaultMaximized?: boolean
  /** On narrow viewports, expand to full screen (better for mobile forms). */
  mobileFullscreen?: boolean
  submitLabel?: string
  submitDisabled?: boolean
}) {
  const { t } = useI18n()
  const [maximized, setMaximized] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  const width = maximized
    ? 'max-w-[min(1200px,96vw)]'
    : size === '2xl'
      ? 'max-w-3xl'
      : size === 'xl'
        ? 'max-w-2xl'
        : size === 'lg' || wide
          ? 'max-w-lg'
          : 'max-w-md'

  useEffect(() => {
    if (!open) {
      setMaximized(false)
      setMinimized(false)
    } else if (defaultMaximized || (mobileFullscreen && isMobile)) {
      setMaximized(true)
      setMinimized(false)
    }
  }, [open, defaultMaximized, mobileFullscreen, isMobile])

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className={`fixed inset-0 z-[80] flex bg-black/70 backdrop-blur-sm ${
            mobileFullscreen ? 'max-md:p-0 max-md:items-stretch max-md:justify-stretch' : 'p-4'
          } ${minimized ? 'items-end justify-start' : mobileFullscreen ? 'items-center justify-center max-md:items-stretch' : 'items-center justify-center'}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !minimized) onClose()
          }}
        >
          <motion.form
            onSubmit={(event) => void onSubmit(event)}
            onInvalidCapture={onInvalid}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className={`glass flex w-full flex-col overflow-hidden ${mobileFullscreen ? 'max-md:h-full max-md:max-h-full max-md:rounded-none max-md:max-w-full' : 'rounded-3xl'} ${width} ${
              minimized
                ? 'max-h-14'
                : maximized
                  ? mobileFullscreen
                    ? 'max-md:h-full max-md:max-h-full h-[min(92vh,900px)] max-h-[92vh]'
                    : 'h-[min(92vh,900px)] max-h-[92vh]'
                  : mobileFullscreen
                    ? 'max-md:h-full max-md:max-h-full max-h-[min(90vh,720px)]'
                    : 'max-h-[min(90vh,720px)]'
            }`}
          >
            <div
              className={`flex shrink-0 items-center gap-3 px-4 ${minimized ? 'h-14 cursor-pointer py-0' : 'px-6 pt-5'}`}
              onDoubleClick={() => {
                if (minimized) setMinimized(false)
                else setMaximized((v) => !v)
              }}
              onClick={() => {
                if (minimized) setMinimized(false)
              }}
            >
              <ModalWindowControls
                maximized={maximized}
                minimized={minimized}
                onClose={onClose}
                onMinimize={() => {
                  if (minimized) setMinimized(false)
                  else {
                    setMinimized(true)
                    setMaximized(false)
                  }
                }}
                onMaximize={() => {
                  setMinimized(false)
                  setMaximized((v) => !v)
                }}
              />
              <h2 className="min-w-0 flex-1 truncate font-display text-lg font-bold">{title}</h2>
            </div>
            {!minimized ? (
              <>
                <div className="shrink-0 px-6">
                  {error ? (
                    <div className="mb-3">
                      <FormAlert>{error}</FormAlert>
                    </div>
                  ) : null}
                  {tabs ? <div className="mb-2">{tabs}</div> : null}
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4">
                  <div className="grid gap-3">{children}</div>
                </div>
                <div className="flex shrink-0 justify-end gap-2 border-t border-line px-6 py-4">
                  <button type="button" className="btn-ghost" onClick={onClose}>
                    {t('cancel')}
                  </button>
                  <button type="submit" disabled={saving || submitDisabled} className="btn-primary">
                    {submitLabel ?? t('save')}
                  </button>
                </div>
              </>
            ) : null}
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
  documentMode,
}: {
  open: boolean
  title: string
  onClose: () => void
  onEdit?: () => void
  children: ReactNode
  size?: 'md' | 'lg' | 'xl' | '2xl'
  documentMode?: boolean
}) {
  const { t } = useI18n()
  const [maximized, setMaximized] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const width = maximized
    ? 'max-w-[min(1200px,96vw)]'
    : size === '2xl'
      ? 'max-w-4xl'
      : size === 'xl'
        ? documentMode
          ? 'max-w-3xl'
          : 'max-w-2xl'
        : size === 'lg'
          ? 'max-w-lg'
          : 'max-w-md'

  useEffect(() => {
    if (!open) {
      setMaximized(false)
      setMinimized(false)
    }
  }, [open])

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className={`fixed inset-0 z-[80] flex bg-black/70 p-4 backdrop-blur-sm ${
            minimized ? 'items-end justify-start' : 'items-center justify-center'
          }`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !minimized) onClose()
          }}
        >
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className={`glass flex w-full flex-col overflow-hidden ${documentMode ? 'rounded-xl' : 'rounded-3xl'} ${width} ${
              minimized
                ? 'max-h-14'
                : maximized
                  ? 'h-[min(92vh,900px)] max-h-[92vh]'
                  : documentMode
                    ? 'max-h-[min(92vh,860px)]'
                    : 'max-h-[min(90vh,720px)]'
            }`}
          >
            <div
              className={`flex shrink-0 items-center gap-3 px-4 ${minimized ? 'h-14 cursor-pointer py-0' : 'px-6 pt-5'}`}
              onDoubleClick={() => {
                if (minimized) setMinimized(false)
                else setMaximized((v) => !v)
              }}
              onClick={() => {
                if (minimized) setMinimized(false)
              }}
            >
              <ModalWindowControls
                maximized={maximized}
                minimized={minimized}
                onClose={onClose}
                onMinimize={() => {
                  if (minimized) setMinimized(false)
                  else {
                    setMinimized(true)
                    setMaximized(false)
                  }
                }}
                onMaximize={() => {
                  setMinimized(false)
                  setMaximized((v) => !v)
                }}
              />
              <h2
                className={`min-w-0 flex-1 truncate ${
                  documentMode ? 'font-sans text-sm font-medium text-muted' : 'font-display text-lg font-bold'
                }`}
              >
                {title}
              </h2>
            </div>
            {!minimized ? (
              <>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4">
                  <div className={documentMode ? '' : 'grid gap-3'}>{children}</div>
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
              </>
            ) : null}
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
