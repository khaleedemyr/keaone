import { createPortal } from 'react-dom'
import { type ReactNode, type RefObject, useEffect } from 'react'
import { useI18n } from '../i18n'
import { useErpFlyoutMount } from './ErpFlyoutContext'

export function useFlyoutDismiss(
  rootRef: RefObject<HTMLElement | null>,
  open: boolean,
  onClose: () => void,
  disabled = false,
) {
  useEffect(() => {
    if (!open || disabled) return

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', onKey)

    const armId = window.setTimeout(() => {
      function onPointerDown(event: PointerEvent) {
        if (!rootRef.current?.contains(event.target as Node)) onClose()
      }
      document.addEventListener('pointerdown', onPointerDown)
      cleanupPointer = () => document.removeEventListener('pointerdown', onPointerDown)
    }, 0)

    let cleanupPointer = () => {}

    return () => {
      window.clearTimeout(armId)
      cleanupPointer()
      document.removeEventListener('keydown', onKey)
    }
  }, [disabled, onClose, open, rootRef])
}

type ErpFlyoutPanelProps = {
  open: boolean
  onClose: () => void
  className?: string
  children: ReactNode
  role?: string
  ariaLabel?: string
}

export function ErpFlyoutPanel({ open, onClose, className = '', children, role, ariaLabel }: ErpFlyoutPanelProps) {
  const { t } = useI18n()
  const mount = useErpFlyoutMount()

  if (!open) return null

  if (mount) {
    return createPortal(
      <>
        <button type="button" className="erp-flyout-backdrop" aria-label={t('close')} onClick={onClose} />
        <div className={`erp-flyout-sheet ${className}`.trim()} role={role} aria-label={ariaLabel}>
          {children}
        </div>
      </>,
      mount,
    )
  }

  return (
    <div className={className} role={role} aria-label={ariaLabel}>
      {children}
    </div>
  )
}
