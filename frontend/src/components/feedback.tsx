import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { pushNotification } from '../desktop/notifyStore'
import { IconCheck, IconClose, IconInfo, IconWarn } from './icons'
import { useI18n } from '../i18n'

export type ToastTone = 'success' | 'error' | 'info' | 'warning'

export type ConfirmOptions = {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'danger' | 'default'
}

type ToastItem = {
  id: string
  tone: ToastTone
  message: string
}

type DialogState = ConfirmOptions & {
  resolve: (value: boolean) => void
}

type FeedbackApi = {
  toast: (message: string, tone?: ToastTone) => void
  success: (message: string) => void
  error: (message: string) => void
  info: (message: string) => void
  warning: (message: string) => void
  confirm: (options: ConfirmOptions) => Promise<boolean>
}

const FeedbackContext = createContext<FeedbackApi | null>(null)

const toneUi: Record<ToastTone, { wrap: string; icon: ReactNode }> = {
  success: {
    wrap: 'border-mint/35 text-mint',
    icon: <IconCheck className="h-5 w-5" />,
  },
  error: {
    wrap: 'border-rose-400/35 text-rose-300',
    icon: <IconWarn className="h-5 w-5" />,
  },
  warning: {
    wrap: 'border-gold/40 text-gold',
    icon: <IconWarn className="h-5 w-5" />,
  },
  info: {
    wrap: 'border-violet/35 text-violet',
    icon: <IconInfo className="h-5 w-5" />,
  },
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n()
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const timers = useRef(new Map<string, number>())

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id)
    if (timer) window.clearTimeout(timer)
    timers.current.delete(id)
    setToasts((current) => current.filter((item) => item.id !== id))
  }, [])

  const toast = useCallback(
    (message: string, tone: ToastTone = 'info') => {
      const id = crypto.randomUUID()
      pushNotification(tone, message)
      setToasts((current) => [...current.slice(-3), { id, tone, message }])
      timers.current.set(
        id,
        window.setTimeout(() => dismiss(id), tone === 'error' ? 5600 : 4200),
      )
    },
    [dismiss],
  )

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setDialog({ ...options, resolve })
    })
  }, [])

  const closeDialog = useCallback((value: boolean) => {
    setDialog((current) => {
      current?.resolve(value)
      return null
    })
  }, [])

  useEffect(() => {
    if (!dialog) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') closeDialog(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dialog, closeDialog])

  const api = useMemo<FeedbackApi>(
    () => ({
      toast,
      success: (message) => toast(message, 'success'),
      error: (message) => toast(message, 'error'),
      info: (message) => toast(message, 'info'),
      warning: (message) => toast(message, 'warning'),
      confirm,
    }),
    [confirm, toast],
  )

  return (
    <FeedbackContext.Provider value={api}>
      {children}

      <div className="pointer-events-none fixed inset-x-0 bottom-[4.7rem] z-[80] flex flex-col-reverse items-center gap-2 px-4 sm:items-end sm:pr-7">
        <AnimatePresence>
          {toasts.map((item) => {
            const ui = toneUi[item.tone]
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 12, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.96 }}
                className={`pointer-events-auto glass flex w-full max-w-sm items-start gap-3 rounded-2xl border px-3.5 py-3 shadow-lg ${ui.wrap}`}
              >
                <span className="mt-0.5 shrink-0">{ui.icon}</span>
                <p className="flex-1 text-sm leading-snug text-fg">{item.message}</p>
                <button
                  type="button"
                  className="shrink-0 rounded-lg p-1 text-muted hover:text-fg"
                  onClick={() => dismiss(item.id)}
                  aria-label={t('close')}
                >
                  <IconClose />
                </button>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {dialog ? (
          <motion.div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-[var(--overlay)] p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => closeDialog(false)}
          >
            <motion.div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="kea-confirm-title"
              initial={{ y: 18, opacity: 0, scale: 0.97 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 10, opacity: 0, scale: 0.97 }}
              className="glass w-full max-w-md rounded-3xl p-6"
              onClick={(event) => event.stopPropagation()}
            >
              <div
                className={`mb-4 flex h-11 w-11 items-center justify-center rounded-2xl ${
                  dialog.tone === 'danger' ? 'bg-rose-500/15 text-rose-300' : 'bg-mint/15 text-mint'
                }`}
              >
                {dialog.tone === 'danger' ? <IconWarn className="h-5 w-5" /> : <IconInfo className="h-5 w-5" />}
              </div>
              <h3 id="kea-confirm-title" className="font-display text-xl font-bold text-fg">
                {dialog.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{dialog.message}</p>
              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  autoFocus={dialog.tone === 'danger'}
                  className="btn-ghost"
                  onClick={() => closeDialog(false)}
                >
                  {dialog.cancelLabel ?? t('cancel')}
                </button>
                <button
                  type="button"
                  autoFocus={dialog.tone !== 'danger'}
                  className={dialog.tone === 'danger' ? 'btn-danger' : 'btn-primary'}
                  onClick={() => closeDialog(true)}
                >
                  {dialog.confirmLabel ?? t('confirmYes')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </FeedbackContext.Provider>
  )
}

export function useFeedback(): FeedbackApi {
  const ctx = useContext(FeedbackContext)
  if (!ctx) throw new Error('useFeedback must be used within FeedbackProvider')
  return ctx
}

export function FormAlert({ children }: { children: ReactNode }) {
  return (
    <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-rose-400/25 bg-rose-500/10 px-3.5 py-3 text-sm text-rose-300">
      <IconWarn className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{children}</span>
    </div>
  )
}
