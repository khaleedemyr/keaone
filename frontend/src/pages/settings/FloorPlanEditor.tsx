import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { DiningLayout, DiningTable, FloorObject, FloorObjectKind, TableShape } from '../../types'
import { useI18n, type MsgKey } from '../../i18n'
import { ChairTop, TableTop, chairLayout } from './FloorFurniture'
import { ACCESSORY_SIZE, AccessoryGlyph, defaultAccessoryLabel } from './FloorAccessories'

const SNAP = 8

export type FloorTool = 'select' | 'table-rect' | 'table-round' | 'wall' | 'separator' | 'counter' | 'plant' | 'pos' | 'cashier' | 'label'

type Sel =
  | { type: 'table'; id: string }
  | { type: 'object'; id: string }
  | null

type Clip =
  | { type: 'table'; table: DiningTable }
  | { type: 'object'; object: FloorObject }

type Drag =
  | { mode: 'move'; sel: Exclude<Sel, null>; ox: number; oy: number; x: number; y: number }
  | { mode: 'resize'; sel: Exclude<Sel, null>; handle: 'se' | 'e' | 's'; x: number; y: number; w: number; h: number }
  | { mode: 'draw'; kind: 'wall' | 'separator'; x0: number; y0: number; x1: number; y1: number }

const PASTE_SHIFT = SNAP * 3

function snap(n: number) {
  return Math.round(n / SNAP) * SNAP
}

function nid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function tableKey(table: DiningTable) {
  return `t-${table.id}`
}

function nextTempId(tables: DiningTable[]) {
  const min = tables.reduce((m, item) => Math.min(m, item.id), 0)
  return min < 0 ? min - 1 : -1
}

function nextTableName(tables: DiningTable[]) {
  const used = new Set(
    tables.map((item) => {
      const match = /^Meja\s+(\d+)$/i.exec(item.name.trim())
      return match ? Number(match[1]) : 0
    }),
  )
  let n = tables.length + 1
  while (used.has(n)) n += 1
  return `Meja ${n}`
}

function copyTableName(name: string, tables: DiningTable[]) {
  return /^Meja\s+\d+$/i.test(name.trim()) ? nextTableName(tables) : name
}

function shifted(x: number, y: number, w: number, h: number, canvasW: number, canvasH: number, step: number) {
  const d = PASTE_SHIFT * step
  return {
    x: clamp(snap(x + d), 0, Math.max(0, canvasW - w)),
    y: clamp(snap(y + d), 0, Math.max(0, canvasH - h)),
  }
}

function rotateBox(x: number, y: number, w: number, h: number) {
  const cx = x + w / 2
  const cy = y + h / 2
  return { x: snap(cx - h / 2), y: snap(cy - w / 2), w: h, h: w }
}

function fromEvent(canvas: HTMLDivElement, event: { clientX: number; clientY: number }) {
  const rect = canvas.getBoundingClientRect()
  return { x: snap(event.clientX - rect.left), y: snap(event.clientY - rect.top) }
}

function drawRect(x0: number, y0: number, x1: number, y1: number, kind: 'wall' | 'separator') {
  const dx = x1 - x0
  const dy = y1 - y0
  const thick = kind === 'wall' ? 12 : 10
  if (Math.abs(dx) >= Math.abs(dy)) {
    return { x: Math.min(x0, x1), y: y0 - Math.floor(thick / 2), w: Math.max(24, Math.abs(dx)), h: thick }
  }
  return { x: x0 - Math.floor(thick / 2), y: Math.min(y0, y1), w: thick, h: Math.max(24, Math.abs(dy)) }
}

function objectToolKey(kind: FloorObjectKind): MsgKey {
  if (kind === 'wall') return 'toolWall'
  if (kind === 'separator') return 'toolSeparator'
  if (kind === 'counter') return 'toolCounter'
  if (kind === 'plant') return 'toolPlant'
  if (kind === 'pos') return 'toolPos'
  if (kind === 'cashier') return 'toolCashier'
  return 'toolLabel'
}

export function FloorPlanEditor({
  layout,
  canEdit,
  onChange,
}: {
  layout: DiningLayout
  canEdit: boolean
  onChange: (next: DiningLayout) => void
}) {
  const { t } = useI18n()
  const canvasRef = useRef<HTMLDivElement>(null)
  const layoutRef = useRef(layout)
  const onChangeRef = useRef(onChange)
  layoutRef.current = layout
  onChangeRef.current = onChange
  const [tool, setTool] = useState<FloorTool>('select')
  const [sel, setSel] = useState<Sel>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [clip, setClip] = useState<Clip | null>(null)
  const dragRef = useRef<Drag | null>(null)
  const selRef = useRef<Sel>(null)
  const clipRef = useRef<Clip | null>(null)
  const pasteStepRef = useRef(1)
  dragRef.current = drag
  selRef.current = sel
  clipRef.current = clip

  const objects = layout.objects ?? []
  const tables = layout.tables ?? []

  function emit(next: DiningLayout) {
    onChangeRef.current(next)
  }

  function selectedTable() {
    if (sel?.type !== 'table') return null
    const index = tables.findIndex((item) => tableKey(item) === sel.id)
    return index < 0 ? null : { index, table: tables[index] }
  }

  function selectedObject() {
    if (sel?.type !== 'object') return null
    const index = objects.findIndex((item) => item.id === sel.id)
    return index < 0 ? null : { index, object: objects[index] }
  }

  function updateTable(index: number, next: Partial<DiningTable>) {
    const current = layoutRef.current
    emit({
      ...current,
      tables: current.tables.map((item, i) => (i === index ? { ...item, ...next } : item)),
    })
  }

  function updateObject(index: number, next: Partial<FloorObject>) {
    const current = layoutRef.current
    emit({
      ...current,
      objects: current.objects.map((item, i) => (i === index ? { ...item, ...next } : item)),
    })
  }

  function placeTable(shape: TableShape, x: number, y: number) {
    const current = layoutRef.current
    const size = 88
    const table: DiningTable = {
      id: nextTempId(current.tables),
      outlet_id: current.outlet_id,
      dining_layout_id: current.id,
      name: nextTableName(current.tables),
      area: null,
      shape,
      seats: 4,
      x: clamp(x - size / 2, 0, current.canvas_width - size),
      y: clamp(y - size / 2, 0, current.canvas_height - size),
      width: size,
      height: size,
      rotation: 0,
      sort_order: current.tables.length + 1,
      is_active: true,
    }
    emit({ ...current, tables: [...current.tables, table] })
    setSel({ type: 'table', id: tableKey(table) })
    setTool('select')
  }

  function placeObject(kind: FloorObjectKind, x: number, y: number) {
    const current = layoutRef.current
    const size = ACCESSORY_SIZE[kind] ?? { w: 120, h: 12 }
    const object: FloorObject = {
      id: nid(kind),
      kind,
      x: clamp(x - size.w / 2, 0, current.canvas_width - size.w),
      y: clamp(y - size.h / 2, 0, current.canvas_height - size.h),
      w: size.w,
      h: size.h,
      rotation: 0,
      label: defaultAccessoryLabel(kind, t('tableArea')),
    }
    emit({ ...current, objects: [...current.objects, object] })
    setSel({ type: 'object', id: object.id })
    setTool('select')
  }

  function removeSelected() {
    const current = layoutRef.current
    const currentSel = selRef.current
    if (currentSel?.type === 'table') {
      emit({ ...current, tables: current.tables.filter((item) => tableKey(item) !== currentSel.id) })
      setSel(null)
      return
    }
    if (currentSel?.type === 'object') {
      emit({ ...current, objects: current.objects.filter((item) => item.id !== currentSel.id) })
      setSel(null)
    }
  }

  function copySelected() {
    const current = layoutRef.current
    const currentSel = selRef.current
    if (currentSel?.type === 'table') {
      const table = current.tables.find((item) => tableKey(item) === currentSel.id)
      if (!table) return false
      setClip({ type: 'table', table: { ...table } })
      pasteStepRef.current = 1
      return true
    }
    if (currentSel?.type === 'object') {
      const object = current.objects.find((item) => item.id === currentSel.id)
      if (!object) return false
      setClip({ type: 'object', object: { ...object } })
      pasteStepRef.current = 1
      return true
    }
    return false
  }

  function pasteFrom(clipItem: Clip, step: number) {
    const current = layoutRef.current
    if (clipItem.type === 'table') {
      const origin = clipItem.table
      const pos = shifted(origin.x ?? 80, origin.y ?? 80, origin.width ?? 88, origin.height ?? 88, current.canvas_width, current.canvas_height, step)
      const table: DiningTable = {
        ...origin,
        id: nextTempId(current.tables),
        name: copyTableName(origin.name, current.tables),
        x: pos.x,
        y: pos.y,
        sort_order: current.tables.length + 1,
        is_active: true,
      }
      emit({ ...current, tables: [...current.tables, table] })
      setSel({ type: 'table', id: tableKey(table) })
    } else {
      const origin = clipItem.object
      const pos = shifted(origin.x, origin.y, origin.w, origin.h, current.canvas_width, current.canvas_height, step)
      const object: FloorObject = { ...origin, id: nid(origin.kind), x: pos.x, y: pos.y }
      emit({ ...current, objects: [...current.objects, object] })
      setSel({ type: 'object', id: object.id })
    }
    setTool('select')
  }

  function pasteClip() {
    const clipItem = clipRef.current
    if (!clipItem) return
    pasteFrom(clipItem, pasteStepRef.current)
    pasteStepRef.current += 1
  }

  function duplicateSelected() {
    const current = layoutRef.current
    const currentSel = selRef.current
    if (currentSel?.type === 'table') {
      const table = current.tables.find((item) => tableKey(item) === currentSel.id)
      if (!table) return
      const clipItem: Clip = { type: 'table', table: { ...table } }
      setClip(clipItem)
      pasteStepRef.current = 2
      pasteFrom(clipItem, 1)
      return
    }
    if (currentSel?.type === 'object') {
      const object = current.objects.find((item) => item.id === currentSel.id)
      if (!object) return
      const clipItem: Clip = { type: 'object', object: { ...object } }
      setClip(clipItem)
      pasteStepRef.current = 2
      pasteFrom(clipItem, 1)
    }
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!canEdit) return
      const target = event.target as HTMLElement | null
      if (target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault()
        removeSelected()
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c') {
        event.preventDefault()
        copySelected()
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'v') {
        event.preventDefault()
        pasteClip()
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd') {
        event.preventDefault()
        duplicateSelected()
      }
      if (event.key === 'Escape') {
        setSel(null)
        setTool('select')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  useEffect(() => {
    if (!drag || !canEdit) return

    function move(event: PointerEvent) {
      const canvas = canvasRef.current
      const currentDrag = dragRef.current
      const plan = layoutRef.current
      if (!canvas || !currentDrag) return
      const pt = fromEvent(canvas, event)
      if (currentDrag.mode === 'draw') {
        setDrag({ ...currentDrag, x1: pt.x, y1: pt.y })
        return
      }
      if (currentDrag.mode === 'move') {
        const nx = snap(currentDrag.x + (pt.x - currentDrag.ox))
        const ny = snap(currentDrag.y + (pt.y - currentDrag.oy))
        if (currentDrag.sel.type === 'table') {
          const index = plan.tables.findIndex((item) => tableKey(item) === currentDrag.sel.id)
          if (index >= 0) {
            const item = plan.tables[index]
            updateTable(index, {
              x: clamp(nx, 0, plan.canvas_width - (item.width ?? 88)),
              y: clamp(ny, 0, plan.canvas_height - (item.height ?? 88)),
            })
          }
        } else {
          const index = plan.objects.findIndex((item) => item.id === currentDrag.sel.id)
          if (index >= 0) {
            const item = plan.objects[index]
            updateObject(index, {
              x: clamp(nx, 0, plan.canvas_width - item.w),
              y: clamp(ny, 0, plan.canvas_height - item.h),
            })
          }
        }
        return
      }
      const dw = pt.x - currentDrag.x
      const dh = pt.y - currentDrag.y
      let w = currentDrag.w
      let h = currentDrag.h
      if (currentDrag.handle === 'e' || currentDrag.handle === 'se') w = currentDrag.w + dw
      if (currentDrag.handle === 's' || currentDrag.handle === 'se') h = currentDrag.h + dh
      if (currentDrag.sel.type === 'table') {
        const index = plan.tables.findIndex((item) => tableKey(item) === currentDrag.sel.id)
        if (index < 0) return
        if (plan.tables[index].shape === 'round') {
          const size = Math.max(40, snap(Math.max(w, h)))
          updateTable(index, { width: size, height: size })
        } else {
          updateTable(index, { width: Math.max(40, snap(w)), height: Math.max(40, snap(h)) })
        }
      } else {
        const index = plan.objects.findIndex((item) => item.id === currentDrag.sel.id)
        if (index >= 0) updateObject(index, { w: Math.max(8, snap(w)), h: Math.max(8, snap(h)) })
      }
    }

    function up() {
      const currentDrag = dragRef.current
      const plan = layoutRef.current
      if (currentDrag?.mode === 'draw') {
        const box = drawRect(currentDrag.x0, currentDrag.y0, currentDrag.x1, currentDrag.y1, currentDrag.kind)
        if (Math.max(box.w, box.h) >= 24) {
          const object: FloorObject = { id: nid(currentDrag.kind), kind: currentDrag.kind, ...box, rotation: 0, label: null }
          emit({ ...plan, objects: [...plan.objects, object] })
          setSel({ type: 'object', id: object.id })
        }
        setTool('select')
      }
      setDrag(null)
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [Boolean(drag), canEdit])

  function onCanvasDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!canEdit || event.button !== 0) return
    const canvas = canvasRef.current
    if (!canvas) return
    const pt = fromEvent(canvas, event)
    if (tool === 'table-rect') {
      placeTable('rect', pt.x, pt.y)
      return
    }
    if (tool === 'table-round') {
      placeTable('round', pt.x, pt.y)
      return
    }
    if (tool === 'counter' || tool === 'label' || tool === 'plant' || tool === 'pos' || tool === 'cashier') {
      placeObject(tool, pt.x, pt.y)
      return
    }
    if (tool === 'wall' || tool === 'separator') {
      setDrag({ mode: 'draw', kind: tool, x0: pt.x, y0: pt.y, x1: pt.x, y1: pt.y })
      return
    }
    setSel(null)
  }

  function startMove(next: Exclude<Sel, null>, item: { x: number; y: number }, event: ReactPointerEvent) {
    if (!canEdit || tool !== 'select') return
    event.stopPropagation()
    const canvas = canvasRef.current
    if (!canvas) return
    const pt = fromEvent(canvas, event)
    setSel(next)
    setDrag({ mode: 'move', sel: next, ox: pt.x, oy: pt.y, x: item.x, y: item.y })
  }

  function startResize(
    next: Exclude<Sel, null>,
    handle: 'se' | 'e' | 's',
    box: { x: number; y: number; w: number; h: number },
    event: ReactPointerEvent,
  ) {
    if (!canEdit) return
    event.stopPropagation()
    setSel(next)
    setDrag({ mode: 'resize', sel: next, handle, x: box.x, y: box.y, w: box.w, h: box.h })
  }

  const tools: { id: FloorTool; label: string }[] = [
    { id: 'select', label: t('toolSelect') },
    { id: 'table-rect', label: t('toolTableRect') },
    { id: 'table-round', label: t('toolTableRound') },
    { id: 'wall', label: t('toolWall') },
    { id: 'separator', label: t('toolSeparator') },
    { id: 'counter', label: t('toolCounter') },
    { id: 'plant', label: t('toolPlant') },
    { id: 'pos', label: t('toolPos') },
    { id: 'cashier', label: t('toolCashier') },
    { id: 'label', label: t('toolLabel') },
  ]

  const pickedTable = selectedTable()
  const pickedObject = selectedObject()
  const drawPreview = drag?.mode === 'draw' ? drawRect(drag.x0, drag.y0, drag.x1, drag.y1, drag.kind) : null

  return (
    <div className="floor-editor">
      <div className="floor-toolbar">
        {tools.map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={!canEdit && item.id !== 'select'}
            className={`floor-tool ${tool === item.id ? 'is-active' : ''}`}
            onClick={() => setTool(item.id)}
          >
            {item.label}
          </button>
        ))}
        {canEdit && clip ? (
          <button type="button" className="floor-tool" onClick={pasteClip}>
            {t('floorPaste')}
          </button>
        ) : null}
      </div>
      <div className="floor-body">
        <div className="floor-scroll">
          <div
            ref={canvasRef}
            className={`floor-canvas ${tool !== 'select' ? 'is-draw' : ''}`}
            style={{ width: layout.canvas_width, height: layout.canvas_height }}
            onPointerDown={onCanvasDown}
          >
            {objects.map((item) => {
              const selected = sel?.type === 'object' && sel.id === item.id
              return (
                <div
                  key={item.id}
                  className={`floor-item floor-${item.kind} ${selected ? 'is-selected' : ''}`}
                  style={{ left: item.x, top: item.y, width: item.w, height: item.h }}
                  onPointerDown={(event) => {
                    event.stopPropagation()
                    startMove({ type: 'object', id: item.id }, item, event)
                  }}
                >
                  {item.kind === 'label' ? <span>{item.label || t('toolLabel')}</span> : <AccessoryGlyph kind={item.kind} w={item.w} h={item.h} label={item.label} />}
                  {selected && canEdit ? (
                    <Handle
                      box={item}
                      onResize={(handle, event) =>
                        startResize({ type: 'object', id: item.id }, handle, { x: item.x, y: item.y, w: item.w, h: item.h }, event)
                      }
                    />
                  ) : null}
                </div>
              )
            })}
            {tables.map((table) => {
              const key = tableKey(table)
              const selected = sel?.type === 'table' && sel.id === key
              const w = table.width ?? 88
              const h = table.height ?? 88
              const shape = table.shape === 'round' ? 'round' : 'rect'
              return (
                <div
                  key={key}
                  className={`floor-item floor-table is-${shape} ${selected ? 'is-selected' : ''}`}
                  style={{ left: table.x ?? 80, top: table.y ?? 80, width: w, height: h }}
                  onPointerDown={(event) => {
                    event.stopPropagation()
                    startMove({ type: 'table', id: key }, { x: table.x ?? 80, y: table.y ?? 80 }, event)
                  }}
                >
                  {chairLayout(table.seats || 4, w, h, shape).map((chair, i) => (
                    <span
                      key={i}
                      className="floor-chair"
                      style={{
                        left: chair.x,
                        top: chair.y,
                        width: chair.size,
                        height: chair.size,
                        transform: `rotate(${chair.rot}deg)`,
                      }}
                    >
                      <ChairTop />
                    </span>
                  ))}
                  <TableTop shape={shape} w={w} h={h} name={table.name} patternId={`wood-${key}`} />
                  {selected && canEdit ? (
                    <Handle
                      box={{ w, h }}
                      onResize={(handle, event) =>
                        startResize({ type: 'table', id: key }, handle, { x: table.x ?? 80, y: table.y ?? 80, w, h }, event)
                      }
                    />
                  ) : null}
                </div>
              )
            })}
            {drawPreview ? (
              <div
                className={`floor-item floor-${drag?.mode === 'draw' ? drag.kind : 'wall'} is-preview`}
                style={{ left: drawPreview.x, top: drawPreview.y, width: drawPreview.w, height: drawPreview.h }}
              />
            ) : null}
          </div>
        </div>
        <aside className="floor-props">
          {pickedTable ? (
            <>
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-mint/80">{t('toolTableRect')}</div>
              <label className="text-sm text-muted">
                {t('name')}
                <input className="field" value={pickedTable.table.name} disabled={!canEdit} onChange={(e) => updateTable(pickedTable.index, { name: e.target.value })} />
              </label>
              <label className="text-sm text-muted">
                {t('tableSeats')}
                <input
                  className="field"
                  type="number"
                  min={1}
                  max={50}
                  disabled={!canEdit}
                  value={pickedTable.table.seats}
                  onChange={(e) => updateTable(pickedTable.index, { seats: clamp(Number(e.target.value || 1), 1, 50) })}
                />
              </label>
              <div className="text-sm text-muted">{t('tableShape')}</div>
              <div className="flex gap-2">
                {(['rect', 'round'] as TableShape[]).map((shape) => (
                  <button
                    key={shape}
                    type="button"
                    disabled={!canEdit}
                    className={`floor-tool ${pickedTable.table.shape === shape ? 'is-active' : ''}`}
                    onClick={() => {
                      const size = Math.min(pickedTable.table.width ?? 88, pickedTable.table.height ?? 88)
                      updateTable(pickedTable.index, {
                        shape,
                        width: shape === 'round' ? size : pickedTable.table.width,
                        height: shape === 'round' ? size : pickedTable.table.height,
                      })
                    }}
                  >
                    {shape === 'rect' ? t('tableShapeRect') : t('tableShapeRound')}
                  </button>
                ))}
              </div>
              {canEdit ? (
                <>
                  <button type="button" className="btn-ghost" onClick={duplicateSelected}>
                    {t('floorDuplicate')}
                  </button>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => {
                      const box = rotateBox(pickedTable.table.x ?? 80, pickedTable.table.y ?? 80, pickedTable.table.width ?? 88, pickedTable.table.height ?? 88)
                      updateTable(pickedTable.index, { x: box.x, y: box.y, width: box.w, height: box.h })
                    }}
                  >
                    {t('rotate90')}
                  </button>
                  <button type="button" className="btn-ghost text-rose-300" onClick={removeSelected}>
                    {t('floorItemDelete')}
                  </button>
                </>
              ) : null}
            </>
          ) : pickedObject ? (
            <>
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-mint/80">
                {t(objectToolKey(pickedObject.object.kind))}
              </div>
              {['counter', 'cashier', 'pos', 'label'].includes(pickedObject.object.kind) ? (
                <label className="text-sm text-muted">
                  {t('name')}
                  <input className="field" disabled={!canEdit} value={pickedObject.object.label ?? ''} onChange={(e) => updateObject(pickedObject.index, { label: e.target.value })} />
                </label>
              ) : null}
              {canEdit ? (
                <>
                  <button type="button" className="btn-ghost" onClick={duplicateSelected}>
                    {t('floorDuplicate')}
                  </button>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => {
                      const box = rotateBox(pickedObject.object.x, pickedObject.object.y, pickedObject.object.w, pickedObject.object.h)
                      updateObject(pickedObject.index, { x: box.x, y: box.y, w: box.w, h: box.h })
                    }}
                  >
                    {t('rotate90')}
                  </button>
                  <button type="button" className="btn-ghost text-rose-300" onClick={removeSelected}>
                    {t('floorItemDelete')}
                  </button>
                </>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-muted">{t('floorPlanHint')}</p>
          )}
        </aside>
      </div>
    </div>
  )
}

function Handle({
  box,
  onResize,
}: {
  box: { w?: number; h?: number }
  onResize: (handle: 'se' | 'e' | 's', event: ReactPointerEvent) => void
}) {
  return (
    <>
      <span className="floor-handle is-e" style={{ top: (box.h ?? 20) / 2 - 5, right: -5 }} onPointerDown={(event) => onResize('e', event)} />
      <span className="floor-handle is-s" style={{ left: (box.w ?? 20) / 2 - 5, bottom: -5 }} onPointerDown={(event) => onResize('s', event)} />
      <span className="floor-handle is-se" style={{ right: -5, bottom: -5 }} onPointerDown={(event) => onResize('se', event)} />
    </>
  )
}
