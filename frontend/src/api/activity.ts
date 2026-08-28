import { TOKEN_KEY, api, sessionGet } from './client'

let lastKey = ''
let lastAt = 0

export type ActivityKind =
  | 'open_app'
  | 'open_section'
  | 'open_calendar'
  | 'view_doc'
  | 'open_form'

export type MasterFormEntity =
  | 'category'
  | 'subcategory'
  | 'unit'
  | 'itemtype'
  | 'pricechannel'
  | 'discount'
  | 'promotion'
  | 'customfield'
  | 'choicetype'
  | 'choice'
  | 'warehouse'
  | 'customer'
  | 'supplier'
  | 'user'
  | 'employee'
  | 'department'
  | 'position'
  | 'joblevel'
  | 'role'
  | 'outlet'
  | 'product'
  | 'pr'
  | 'po'
  | 'gr'

export function logActivity(kind: ActivityKind, target: string, ref?: string) {
  if (typeof localStorage === 'undefined' || !sessionGet(TOKEN_KEY)) return
  const key = `${kind}:${target}:${ref ?? ''}`
  const now = Date.now()
  if (key === lastKey && now - lastAt < 2000) return
  lastKey = key
  lastAt = now
  void api
    .post('/activity-logs/events', { kind, target, ref: ref || undefined }, { silent: true })
    .catch(() => {})
}

export function logMasterForm(entity: MasterFormEntity, mode: 'create' | 'edit', ref?: string) {
  logActivity('open_form', `${entity}:${mode}`, ref)
}
