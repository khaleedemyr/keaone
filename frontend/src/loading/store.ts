export type LoadingSnapshot = {
  active: boolean
  overlay: boolean
  progress: number
}

type Listener = (state: LoadingSnapshot) => void

const listeners = new Set<Listener>()

let pending = 0
let value = 0
let active = false
let overlay = false
let tick: number | undefined
let overlayTimer: number | undefined
let hideTimer: number | undefined

function snapshot(): LoadingSnapshot {
  return { active, overlay, progress: Math.round(value) }
}

function emit() {
  const next = snapshot()
  listeners.forEach((fn) => fn(next))
}

function clearTimers() {
  if (tick) window.clearInterval(tick)
  if (overlayTimer) window.clearTimeout(overlayTimer)
  if (hideTimer) window.clearTimeout(hideTimer)
  tick = overlayTimer = hideTimer = undefined
}

export function getLoading(): LoadingSnapshot {
  return snapshot()
}

export function subscribeLoading(listener: Listener) {
  listeners.add(listener)
  listener(snapshot())
  return () => {
    listeners.delete(listener)
  }
}

export function startLoading() {
  if (typeof window === 'undefined') return
  pending += 1
  if (pending !== 1) return

  clearTimers()
  active = true
  overlay = false
  value = 10
  emit()

  overlayTimer = window.setTimeout(() => {
    overlay = true
    emit()
  }, 180)

  tick = window.setInterval(() => {
    value += (92 - value) * 0.08
    if (value > 91.5) value = 91.5
    emit()
  }, 110)
}

export function setLoadingProgress(percent: number) {
  if (pending <= 0) return
  const next = Math.min(94, Math.max(value, percent))
  value = next
  emit()
}

export function stopLoading() {
  if (typeof window === 'undefined') return
  pending = Math.max(0, pending - 1)
  if (pending > 0) return

  if (tick) window.clearInterval(tick)
  if (overlayTimer) window.clearTimeout(overlayTimer)
  tick = overlayTimer = undefined

  value = 100
  emit()

  hideTimer = window.setTimeout(() => {
    active = false
    overlay = false
    value = 0
    emit()
  }, 280)
}

export function isSilentRequest(url: string) {
  return (
    url.includes('/activity-logs/events') ||
    url.includes('/me/preferences') ||
    url.includes('/chat/conversations') ||
    url.includes('/chat/peers') ||
    url.includes('/chat/')
  )
}
