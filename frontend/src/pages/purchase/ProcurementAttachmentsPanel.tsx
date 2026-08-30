import { useEffect, useRef, useState, type FormEvent } from 'react'
import { api, apiMessage, apiUpload } from '../../api/client'
import type { ApiOk } from '../../types'
import { useFeedback } from '../../components/feedback'
import { useAccess } from '../../access'
import { useAuth } from '../../auth'
import { useI18n } from '../../i18n'
import type { PurchaseDocKind } from './PurchaseDocs'

export type ProcurementAttachmentDocumentType = 'purchase_requisition' | 'purchase_order' | 'goods_receipt'

type AttachmentRow = {
  id: number
  category: string
  original_name: string
  mime_type?: string | null
  size_bytes: number
  note?: string | null
  uploader?: { id: number; name: string } | null
  created_at?: string | null
}

const MENU_BY_TYPE: Record<ProcurementAttachmentDocumentType, 'purchaserequisitions' | 'purchaseorders' | 'goodsreceipts'> = {
  purchase_requisition: 'purchaserequisitions',
  purchase_order: 'purchaseorders',
  goods_receipt: 'goodsreceipts',
}

export function docKindToAttachmentType(kind: Exclude<PurchaseDocKind, 'direct'>): ProcurementAttachmentDocumentType {
  if (kind === 'pr') return 'purchase_requisition'
  if (kind === 'po') return 'purchase_order'
  return 'goods_receipt'
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function ProcurementAttachmentsPanel({
  documentType,
  documentId,
}: {
  documentType: ProcurementAttachmentDocumentType
  documentId: number
}) {
  const { t } = useI18n()
  const { me } = useAuth()
  const { can } = useAccess()
  const feedback = useFeedback()
  const fileRef = useRef<HTMLInputElement>(null)

  const enabled = me?.settings?.procurement_attachments_enabled !== false
  const menu = MENU_BY_TYPE[documentType]
  const canEdit = can(menu, 'edit')
  const canDelete = can(menu, 'delete') || canEdit

  const [rows, setRows] = useState<AttachmentRow[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState('other')
  const [note, setNote] = useState('')
  const [uploading, setUploading] = useState(false)

  async function loadRows() {
    if (!enabled || !documentId) return
    setLoading(true)
    try {
      const { data } = await api.get<ApiOk<AttachmentRow[]>>('/procurement/attachments', {
        params: { document_type: documentType, document_id: documentId },
        silent: true,
      })
      setRows(data.data ?? [])
    } catch (err) {
      feedback.error(apiMessage(err, t('loadFailed')))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadRows()
  }, [documentType, documentId, enabled]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!enabled) return null

  function categoryLabel(value: string) {
    const map: Record<string, string> = {
      quotation: t('procurementAttachmentsCategoryQuotation'),
      photo: t('procurementAttachmentsCategoryPhoto'),
      other: t('procurementAttachmentsCategoryOther'),
    }
    return map[value] ?? value
  }

  async function onUpload(event: FormEvent) {
    event.preventDefault()
    const file = fileRef.current?.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      feedback.error(t('procurementAttachmentsTooLarge'))
      return
    }

    setUploading(true)
    try {
      const body = new FormData()
      body.append('document_type', documentType)
      body.append('document_id', String(documentId))
      body.append('category', category)
      if (note.trim()) body.append('note', note.trim())
      body.append('file', file, file.name)
      await apiUpload('/procurement/attachments', body)
      feedback.success(t('saved'))
      setOpen(false)
      setCategory('other')
      setNote('')
      if (fileRef.current) fileRef.current.value = ''
      void loadRows()
    } catch (err) {
      feedback.error(apiMessage(err, t('saveFailed')))
    } finally {
      setUploading(false)
    }
  }

  async function viewFile(row: AttachmentRow) {
    try {
      const { data } = await api.get<Blob>(`/procurement/attachments/${row.id}/file`, {
        responseType: 'blob',
        silent: true,
      })
      const url = URL.createObjectURL(data)
      const link = document.createElement('a')
      link.href = url
      link.target = '_blank'
      link.rel = 'noreferrer'
      if (row.mime_type === 'application/pdf' || !String(row.mime_type ?? '').startsWith('image/')) {
        link.download = row.original_name
      }
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (err) {
      feedback.error(apiMessage(err, t('loadFailed')))
    }
  }

  async function removeRow(row: AttachmentRow) {
    const ok = await feedback.confirm({
      title: t('delete'),
      message: t('deleteConfirm', { name: row.original_name }),
    })
    if (!ok) return
    try {
      await api.delete(`/procurement/attachments/${row.id}`)
      feedback.success(t('deleted'))
      void loadRows()
    } catch (err) {
      feedback.error(apiMessage(err, t('deleteFailed')))
    }
  }

  return (
    <section className="mt-4 rounded-2xl border border-line p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-medium text-fg">{t('procurementAttachmentsTitle')}</div>
          <div className="text-xs text-muted">{t('procurementAttachmentsHint')}</div>
        </div>
        {canEdit ? (
          <button type="button" className="btn-ghost !text-xs" onClick={() => setOpen((v) => !v)}>
            {open ? t('cancel') : t('procurementAttachmentsUpload')}
          </button>
        ) : null}
      </div>

      {loading ? (
        <p className="text-xs text-muted">{t('loading')}</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted">{t('procurementAttachmentsEmpty')}</p>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line/70 px-3 py-2 text-sm">
              <div className="min-w-0">
                <div className="truncate font-medium text-fg">{row.original_name}</div>
                <div className="text-xs text-muted">
                  {categoryLabel(row.category)}
                  {' · '}
                  {formatBytes(row.size_bytes)}
                  {row.uploader?.name ? ` · ${row.uploader.name}` : ''}
                  {row.note ? ` · ${row.note}` : ''}
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <button type="button" className="btn-ghost !px-2 !py-1" onClick={() => void viewFile(row)}>
                  {t('procurementAttachmentsView')}
                </button>
                {canDelete ? (
                  <button type="button" className="btn-ghost !px-2 !py-1" onClick={() => void removeRow(row)}>
                    {t('delete')}
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      {open && canEdit ? (
        <form onSubmit={(e) => void onUpload(e)} className="mt-3 grid gap-2 border-t border-line pt-3 md:grid-cols-2">
          <label className="block text-xs text-muted">
            {t('procurementAttachmentsCategory')}
            <select className="field !mt-1" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="quotation">{t('procurementAttachmentsCategoryQuotation')}</option>
              <option value="photo">{t('procurementAttachmentsCategoryPhoto')}</option>
              <option value="other">{t('procurementAttachmentsCategoryOther')}</option>
            </select>
          </label>
          <label className="block text-xs text-muted md:col-span-2">
            {t('purchaseNote')}
            <input className="field !mt-1" value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <label className="block text-xs text-muted md:col-span-2">
            {t('procurementAttachmentsUpload')}
            <input
              ref={fileRef}
              className="field !mt-1"
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              required
            />
          </label>
          <div className="md:col-span-2">
            <button type="submit" className="btn-primary !text-xs" disabled={uploading}>
              {t('save')}
            </button>
          </div>
        </form>
      ) : null}
    </section>
  )
}
