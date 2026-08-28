import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const WRAP_SELECTORS = [
  '.glass.rounded-3xl:has(> table)',
  '.glass.rounded-2xl:has(> table)',
  '.rounded-2xl.border.border-line:has(> table)',
  '.overflow-hidden.rounded-2xl.border.border-line:has(> table)',
  '.overflow-auto.rounded-2xl.border.border-line:has(> table)',
].join(',')

export function applyMasterTableLabels(root: ParentNode = document) {
  root.querySelectorAll(WRAP_SELECTORS).forEach((wrap) => {
    if (!(wrap instanceof HTMLElement)) return
    wrap.classList.add('master-table-wrap')

    const table = wrap.querySelector(':scope > table')
    if (!table) return

    const headers = Array.from(table.querySelectorAll('thead th')).map((th) => th.textContent?.trim() ?? '')

    table.querySelectorAll('tbody tr').forEach((tr) => {
      const cells = Array.from(tr.querySelectorAll(':scope > td'))
      const emptyCell = cells.length === 1 && cells[0].hasAttribute('colspan')

      cells.forEach((td) => {
        td.classList.remove('master-actions', 'master-primary', 'master-empty')
      })

      if (emptyCell) {
        cells[0].classList.add('master-empty')
        cells[0].removeAttribute('data-label')
        return
      }

      cells.forEach((td, index) => {
        const label = headers[index] ?? ''
        if (label) {
          td.setAttribute('data-label', label)
        } else {
          td.removeAttribute('data-label')
        }

        const isActions = !label && index === cells.length - 1
        td.classList.toggle('master-actions', isActions)
        td.classList.toggle('master-primary', index === 0)
      })
    })
  })
}

export function useMasterTableLabels() {
  const location = useLocation()

  useEffect(() => {
    let frame = 0

    const run = () => {
      frame = 0
      applyMasterTableLabels()
    }

    const schedule = () => {
      if (frame) return
      frame = window.requestAnimationFrame(run)
    }

    schedule()
    const timer = window.setTimeout(schedule, 120)

    const observer = new MutationObserver(schedule)
    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      window.clearTimeout(timer)
      if (frame) window.cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [location.pathname, location.search])
}
