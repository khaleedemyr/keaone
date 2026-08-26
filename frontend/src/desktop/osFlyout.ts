export type OsFlyout = 'clock' | 'notify' | 'chat'

const EVENT = 'kea-os-flyout'

export function openOsFlyout(id: OsFlyout) {
  window.dispatchEvent(new CustomEvent<OsFlyout>(EVENT, { detail: id }))
}

export function onOsFlyout(id: OsFlyout, close: () => void) {
  function handle(event: Event) {
    const next = (event as CustomEvent<OsFlyout>).detail
    if (next !== id) close()
  }
  window.addEventListener(EVENT, handle)
  return () => window.removeEventListener(EVENT, handle)
}
