import { useEffect, useMemo, useRef, useState } from 'react'
import { ReceiptPaper, receiptKindLabel } from '../../components/ReceiptPaper'
import { useFeedback } from '../../components/feedback'
import { useI18n, type MsgKey } from '../../i18n'
import { useAuth } from '../../auth'
import { api, apiMessage, apiUpload } from '../../api/client'
import type { ApiOk, Company } from '../../types'
import {
  defaultReceiptLayout,
  isCustomBlock,
  newReceiptBlock,
  sampleReceiptPayload,
  type ReceiptAlign,
  type ReceiptBlock,
  type ReceiptLayout,
  type ReceiptSize,
} from '../../lib/receiptLayout'

export function ReceiptDesigner({
  layout,
  onChange,
  canEdit,
}: {
  layout: ReceiptLayout
  onChange: (layout: ReceiptLayout) => void
  canEdit: boolean
}) {
  const { t } = useI18n()
  const { me, refresh } = useAuth()
  const feedback = useFeedback()
  const fileRef = useRef<HTMLInputElement>(null)
  const [selectedId, setSelectedId] = useState<string | null>(layout.blocks[0]?.id ?? null)
  const [logoUrl, setLogoUrl] = useState<string | null>(me?.company?.logo ?? null)
  const [uploading, setUploading] = useState(false)
  const selected = layout.blocks.find((block) => block.id === selectedId) ?? null
  const footer = layout.blocks.find((block) => block.kind === 'footer')?.text || 'Terima kasih'

  useEffect(() => {
    setLogoUrl(me?.company?.logo ?? null)
  }, [me?.company?.logo])

  const preview = useMemo(
    () =>
      sampleReceiptPayload({
        company: me?.company?.name || 'Toko Demo',
        outlet: me?.outlet?.name,
        address: me?.company?.address,
        phone: me?.company?.phone,
        logo: logoUrl,
        cashier: me?.user.name,
        footer,
        width: layout.width,
        layout,
      }),
    [footer, layout, logoUrl, me],
  )

  function patchBlock(id: string, patch: Partial<ReceiptBlock>) {
    onChange({
      ...layout,
      blocks: layout.blocks.map((block) => (block.id === id ? { ...block, ...patch } : block)),
    })
  }

  function move(id: string, dir: -1 | 1) {
    const index = layout.blocks.findIndex((block) => block.id === id)
    const next = index + dir
    if (index < 0 || next < 0 || next >= layout.blocks.length) return
    const blocks = [...layout.blocks]
    const [row] = blocks.splice(index, 1)
    blocks.splice(next, 0, row)
    onChange({ ...layout, blocks })
  }

  function add(kind: 'text' | 'divider' | 'spacer') {
    const block = newReceiptBlock(kind)
    onChange({ ...layout, blocks: [...layout.blocks, block] })
    setSelectedId(block.id)
  }

  function remove(id: string) {
    const blocks = layout.blocks.filter((block) => block.id !== id)
    onChange({ ...layout, blocks })
    if (selectedId === id) setSelectedId(blocks[0]?.id ?? null)
  }

  async function onLogo(file: File | undefined) {
    if (!file) return
    if (file.size > 4 * 1024 * 1024) {
      feedback.error(t('avatarTooLarge'))
      return
    }
    setUploading(true)
    try {
      const body = new FormData()
      body.append('file', file, file.name)
      const data = await apiUpload<ApiOk<Company>>('/company/logo', body, 60000)
      setLogoUrl(data.data.logo ?? null)
      await refresh()
      feedback.success(t('receiptLogoApplied'))
    } catch (err) {
      feedback.error(apiMessage(err, t('receiptLogoFailed')))
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function onRemoveLogo() {
    setUploading(true)
    try {
      await api.delete('/company/logo')
      setLogoUrl(null)
      await refresh()
      feedback.success(t('receiptLogoApplied'))
    } catch (err) {
      feedback.error(apiMessage(err, t('receiptLogoFailed')))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="receipt-designer">
      <div className="receipt-designer-preview">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{t('receiptPreview')}</div>
        <div className="receipt-stage">
          <ReceiptPaper receipt={preview} layout={layout} selectedId={selectedId} onSelect={setSelectedId} />
        </div>
      </div>

      <div className="receipt-designer-side">
        <div className="flex flex-wrap gap-2">
          {([58, 80] as const).map((width) => (
            <button
              key={width}
              type="button"
              disabled={!canEdit}
              onClick={() => onChange({ ...layout, width })}
              className={`rounded-xl px-3 py-2 text-sm ${layout.width === width ? 'bg-mint font-semibold text-ink' : 'bg-fill text-muted'}`}
            >
              {width} mm
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-ghost py-1.5 text-xs" disabled={!canEdit} onClick={() => add('text')}>
            + {t('receiptAddText')}
          </button>
          <button type="button" className="btn-ghost py-1.5 text-xs" disabled={!canEdit} onClick={() => add('divider')}>
            + {t('receiptAddDivider')}
          </button>
          <button type="button" className="btn-ghost py-1.5 text-xs" disabled={!canEdit} onClick={() => add('spacer')}>
            + {t('receiptAddSpacer')}
          </button>
          <button
            type="button"
            className="btn-ghost py-1.5 text-xs"
            disabled={!canEdit}
            onClick={() => {
              const next = defaultReceiptLayout({ receipt_width: layout.width, receipt_footer: footer })
              onChange(next)
              setSelectedId(next.blocks[0]?.id ?? null)
            }}
          >
            {t('receiptReset')}
          </button>
        </div>

        <div className="receipt-block-list">
          {layout.blocks.map((block, index) => (
            <div key={block.id} className={`receipt-block-row ${selectedId === block.id ? 'is-on' : ''}`}>
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setSelectedId(block.id)}>
                <div className="truncate text-sm font-medium">{t(receiptKindLabel(block.kind))}</div>
                {!block.enabled ? <div className="text-[11px] text-muted">{t('receiptHidden')}</div> : null}
              </button>
              <button type="button" className="btn-ghost px-2 py-1 text-xs" disabled={!canEdit || index === 0} onClick={() => move(block.id, -1)}>
                ↑
              </button>
              <button
                type="button"
                className="btn-ghost px-2 py-1 text-xs"
                disabled={!canEdit || index === layout.blocks.length - 1}
                onClick={() => move(block.id, 1)}
              >
                ↓
              </button>
              <button
                type="button"
                className="btn-ghost px-2 py-1 text-xs"
                disabled={!canEdit}
                onClick={() => patchBlock(block.id, { enabled: !block.enabled })}
              >
                {block.enabled ? '●' : '○'}
              </button>
            </div>
          ))}
        </div>

        {selected ? (
          <div className="space-y-3 rounded-2xl border border-line p-3">
            <div className="text-sm font-medium">{t(receiptKindLabel(selected.kind))}</div>
            {(['left', 'center', 'right'] as ReceiptAlign[]).map((align) => {
              const label: Record<ReceiptAlign, MsgKey> = {
                left: 'receiptAlignLeft',
                center: 'receiptAlignCenter',
                right: 'receiptAlignRight',
              }
              return (
                <button
                  key={align}
                  type="button"
                  disabled={!canEdit}
                  onClick={() => patchBlock(selected.id, { align })}
                  className={`mr-1 rounded-lg px-2 py-1 text-xs ${selected.align === align ? 'bg-mint text-ink' : 'bg-fill text-muted'}`}
                >
                  {t(label[align])}
                </button>
              )
            })}
            <div className="flex flex-wrap gap-1">
              {(['sm', 'md', 'lg'] as ReceiptSize[]).map((size) => {
                const label: Record<ReceiptSize, MsgKey> = {
                  sm: 'receiptSizeSm',
                  md: 'receiptSizeMd',
                  lg: 'receiptSizeLg',
                }
                return (
                  <button
                    key={size}
                    type="button"
                    disabled={!canEdit}
                    onClick={() => patchBlock(selected.id, { size })}
                    className={`rounded-lg px-2 py-1 text-xs ${selected.size === size ? 'bg-mint text-ink' : 'bg-fill text-muted'}`}
                  >
                    {t(label[size])}
                  </button>
                )
              })}
              {selected.kind !== 'logo' ? (
                <label className="ml-2 inline-flex items-center gap-1 text-xs text-muted">
                  <input
                    type="checkbox"
                    disabled={!canEdit}
                    checked={selected.bold}
                    onChange={(e) => patchBlock(selected.id, { bold: e.target.checked })}
                  />
                  {t('receiptBold')}
                </label>
              ) : null}
            </div>
            {selected.kind === 'logo' ? (
              <div className="space-y-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(event) => void onLogo(event.target.files?.[0])}
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn-ghost py-1.5 text-xs"
                    disabled={!canEdit || uploading}
                    onClick={() => fileRef.current?.click()}
                  >
                    {t('receiptUploadLogo')}
                  </button>
                  {logoUrl ? (
                    <button
                      type="button"
                      className="btn-ghost py-1.5 text-xs text-rose-300"
                      disabled={!canEdit || uploading}
                      onClick={() => void onRemoveLogo()}
                    >
                      {t('receiptRemoveLogo')}
                    </button>
                  ) : null}
                </div>
                <p className="text-xs text-muted">{t('avatarHint')}</p>
              </div>
            ) : null}
            {selected.kind === 'text' || selected.kind === 'footer' ? (
              <textarea
                className="field min-h-20"
                disabled={!canEdit}
                value={selected.text ?? ''}
                onChange={(e) => patchBlock(selected.id, { text: e.target.value })}
              />
            ) : null}
            {isCustomBlock(selected) ? (
              <button type="button" className="btn-ghost text-rose-300" disabled={!canEdit} onClick={() => remove(selected.id)}>
                {t('delete')}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
