import { useEffect, useState } from 'react'
import { api, apiMessage } from '../../api/client'
import type { ApiOk, DiningLayout, Outlet } from '../../types'
import { useFeedback } from '../../components/feedback'
import { PageHeader } from '../../components/ui'
import { useI18n } from '../../i18n'
import { useAccess } from '../../access'
import { FloorPlanEditor } from './FloorPlanEditor'

export default function CafeTables() {
  const { t } = useI18n()
  const { can } = useAccess()
  const feedback = useFeedback()
  const [outlets, setOutlets] = useState<Outlet[]>([])
  const [layouts, setLayouts] = useState<DiningLayout[]>([])
  const [outletId, setOutletId] = useState('')
  const [layoutId, setLayoutId] = useState('')
  const [draft, setDraft] = useState<DiningLayout | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')

  const canEdit = can('cafetables', 'edit')
  const canCreate = can('cafetables', 'create')

  function defaultOutlet(list: Outlet[]) {
    const picked = list.find((item) => item.is_default) ?? list.find((item) => item.is_active !== false) ?? list[0]
    return picked ? String(picked.id) : ''
  }

  async function loadLayouts(nextOutletId: string, keepId?: string) {
    if (!nextOutletId) {
      setLayouts([])
      setLayoutId('')
      setDraft(null)
      setDirty(false)
      return
    }
    try {
      const { data } = await api.get<ApiOk<DiningLayout[]>>('/dining-layouts', {
        params: { outlet_id: Number(nextOutletId), for_select: 1, status: 'active' },
      })
      const rows = data.data
      setLayouts(rows)
      const preferred = keepId && rows.some((item) => String(item.id) === keepId) ? keepId : rows[0] ? String(rows[0].id) : ''
      setLayoutId(preferred)
      if (!preferred) {
        setDraft(null)
        setDirty(false)
      }
    } catch (err) {
      feedback.error(apiMessage(err, t('loadFailed')))
    }
  }

  async function loadPlan(id: string) {
    if (!id) {
      setDraft(null)
      return
    }
    try {
      const { data } = await api.get<ApiOk<DiningLayout>>(`/dining-layouts/${id}`)
      setDraft(data.data)
      setName(data.data.name)
      setDirty(false)
    } catch (err) {
      feedback.error(apiMessage(err, t('loadFailed')))
    }
  }

  async function confirmLeave() {
    if (!dirty) return true
    return feedback.confirm({
      title: t('navCafeTables'),
      message: t('unsavedFloorPlan'),
      tone: 'danger',
    })
  }

  useEffect(() => {
    void api
      .get<ApiOk<Outlet[]>>('/outlets', { params: { for_select: 1, status: 'all' }, silent: true })
      .then(({ data }) => {
        setOutlets(data.data)
        const next = defaultOutlet(data.data)
        setOutletId(next)
        void loadLayouts(next)
      })
      .catch(() => setOutlets([]))
  }, [])

  useEffect(() => {
    if (layoutId) void loadPlan(layoutId)
  }, [layoutId])

  async function onOutletChange(next: string) {
    if (!(await confirmLeave())) return
    setOutletId(next)
    await loadLayouts(next)
  }

  async function onLayoutChange(next: string) {
    if (next === layoutId) return
    if (!(await confirmLeave())) return
    setLayoutId(next)
  }

  async function createLayout() {
    if (!outletId) {
      feedback.error(t('floorNoOutlet'))
      return
    }
    if (!(await confirmLeave())) return
    try {
      const { data } = await api.post<ApiOk<DiningLayout>>('/dining-layouts', {
        outlet_id: Number(outletId),
        name: t('floorPlanNew'),
      })
      setLayouts((current) => [...current, data.data])
      setLayoutId(String(data.data.id))
      setDraft(data.data)
      setName(data.data.name)
      setDirty(false)
    } catch (err) {
      feedback.error(apiMessage(err, t('saveFailed')))
    }
  }

  async function save() {
    if (!draft || !canEdit) return
    setSaving(true)
    try {
      const { data } = await api.put<ApiOk<DiningLayout>>(`/dining-layouts/${draft.id}`, {
        name: name.trim() || draft.name,
        canvas_width: draft.canvas_width,
        canvas_height: draft.canvas_height,
        objects: draft.objects,
        tables: draft.tables.map((table, index) => ({
          id: table.id > 0 ? table.id : undefined,
          name: table.name,
          area: table.area,
          shape: table.shape ?? 'rect',
          seats: table.seats,
          x: table.x ?? 80,
          y: table.y ?? 80,
          width: table.width ?? 88,
          height: table.height ?? 88,
          rotation: table.rotation ?? 0,
          sort_order: index + 1,
        })),
      })
      setDraft(data.data)
      setName(data.data.name)
      setLayouts((current) => current.map((item) => (item.id === data.data.id ? { ...item, name: data.data.name } : item)))
      setDirty(false)
      feedback.success(t('saved'))
    } catch (err) {
      feedback.error(apiMessage(err, t('saveFailed')))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-col">
      <PageHeader
        eyebrow={t('appSettings')}
        title={t('navCafeTables')}
        subtitle={t('cafeTablesSubtitle')}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {canCreate ? (
              <button type="button" className="btn-ghost" onClick={() => void createLayout()}>
                {t('addFloorPlan')}
              </button>
            ) : null}
            {canEdit && draft ? (
              <button type="button" disabled={saving || !dirty} className="btn-primary" onClick={() => void save()}>
                {t('floorPlanSave')}
              </button>
            ) : null}
          </div>
        }
      />

      <div className="mb-3 flex flex-wrap gap-3">
        <label className="text-sm text-muted">
          {t('navOutlets')}
          <select className="field min-w-44" value={outletId} onChange={(e) => void onOutletChange(e.target.value)}>
            <option value="">{t('selectOutlet')}</option>
            {outlets
              .filter((item) => item.is_active !== false || String(item.id) === outletId)
              .map((outlet) => (
                <option key={outlet.id} value={outlet.id}>
                  {outlet.name}
                </option>
              ))}
          </select>
        </label>
        <label className="text-sm text-muted">
          {t('floorPlanName')}
          <select className="field min-w-44" value={layoutId} onChange={(e) => void onLayoutChange(e.target.value)}>
            {layouts.length === 0 ? <option value="">{t('emptyFloorPlan')}</option> : null}
            {layouts.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        {draft && canEdit ? (
          <label className="text-sm text-muted">
            {t('name')}
            <input
              className="field min-w-40"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setDirty(true)
                setDraft({ ...draft, name: e.target.value })
              }}
            />
          </label>
        ) : null}
      </div>

      {draft ? (
        <FloorPlanEditor
          layout={draft}
          canEdit={canEdit}
          onChange={(next) => {
            setDraft(next)
            setDirty(true)
          }}
        />
      ) : (
        <div className="glass rounded-3xl px-5 py-10 text-center text-sm text-muted">{outletId ? t('emptyFloorPlan') : t('floorNoOutlet')}</div>
      )}
    </div>
  )
}
