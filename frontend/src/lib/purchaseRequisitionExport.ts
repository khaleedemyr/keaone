import jsPDF from 'jspdf'
import autoTable, { type RowInput } from 'jspdf-autotable'
import QRCode from 'qrcode'

export type PrExportRow = {
  number: string
  status: string
  needed_at?: string | null
  note?: string | null
  created_at?: string | null
  user?: { name?: string | null } | null
  approver?: { name?: string | null } | null
  approved_at?: string | null
  warehouse?: { name?: string } | null
  outlet?: { name?: string } | null
  approvals?: Array<{
    level: number
    status?: string
    user?: { name?: string | null } | null
    acted_at?: string | null
  }>
  items?: Array<{
    name_snapshot?: string | null
    product?: { name?: string; sku?: string | null } | null
    qty: number
    unit?: string | null
    suggested_unit_cost?: number
    note?: string | null
  }>
}

type PrExportLabels = {
  title: string
  warehouse: string
  outlet: string
  neededAt: string
  note: string
  product: string
  qty: string
  unit: string
  unitCost: string
  createdAt: string
  createdBy: string
  approvedBy: string
  approvalLevel: string
  qrHint: string
  generatedBy: string
}

type PrExportOptions = {
  companyName?: string
  companyPhone?: string
  companyAddress?: string
  statusLabel?: string
}

const COLORS = {
  brand: [15, 118, 110] as [number, number, number],
  brandLight: [236, 253, 249] as [number, number, number],
  ink: [15, 23, 42] as [number, number, number],
  muted: [100, 116, 139] as [number, number, number],
  line: [226, 232, 240] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
}

const PAGE_W = 595.28
const MARGIN = 40

function formatDateTime(iso: string | null | undefined, locale: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(locale, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatDateOnly(iso: string | null | undefined, locale: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' })
}

function drawMetaBox(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  title: string,
  lines: string[],
) {
  const lineH = 13
  const pad = 10
  const h = pad * 2 + 14 + lines.length * lineH
  doc.setDrawColor(...COLORS.line)
  doc.setFillColor(...COLORS.brandLight)
  doc.roundedRect(x, y, w, h, 6, 6, 'FD')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...COLORS.brand)
  doc.text(title.toUpperCase(), x + pad, y + 16)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(...COLORS.ink)
  lines.forEach((line, index) => {
    doc.text(line, x + pad, y + 30 + index * lineH)
  })
  return h
}

export async function exportPrPdf(
  pr: PrExportRow,
  labels: PrExportLabels,
  formatMoney: (value: number) => string,
  options: PrExportOptions = {},
  locale = 'id-ID',
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  const companyName = options.companyName ?? '—'
  const statusText = options.statusLabel ?? pr.status

  const qrDataUrl = await QRCode.toDataURL(pr.number, {
    margin: 1,
    width: 240,
    color: { dark: '#0f172a', light: '#ffffff' },
  })

  doc.setFillColor(...COLORS.brand)
  doc.rect(0, 0, PAGE_W, 96, 'F')

  doc.setTextColor(...COLORS.white)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.text(companyName, MARGIN, 38)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(labels.title.toUpperCase(), MARGIN, 56)
  if (options.companyPhone || options.companyAddress) {
    doc.setFontSize(8.5)
    const contact = [options.companyPhone, options.companyAddress].filter(Boolean).join(' · ')
    doc.text(contact, MARGIN, 72, { maxWidth: PAGE_W - MARGIN * 2 - 100 })
  }

  const qrSize = 68
  const qrX = PAGE_W - MARGIN - qrSize
  const qrY = 14
  doc.setFillColor(...COLORS.white)
  doc.roundedRect(qrX - 6, qrY - 4, qrSize + 12, qrSize + 28, 4, 4, 'F')
  doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize)
  doc.setFontSize(7)
  doc.setTextColor(...COLORS.ink)
  doc.text(pr.number, qrX + qrSize / 2, qrY + qrSize + 10, { align: 'center' })
  doc.setFontSize(6)
  doc.setTextColor(...COLORS.muted)
  doc.text(labels.qrHint, qrX + qrSize / 2, qrY + qrSize + 18, { align: 'center', maxWidth: qrSize + 8 })

  let y = 116

  doc.setTextColor(...COLORS.ink)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.text(pr.number, MARGIN, y)
  const numberW = doc.getTextWidth(pr.number)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  const badgeW = doc.getTextWidth(statusText.toUpperCase()) + 16
  const badgeX = MARGIN + numberW + 14
  doc.setFillColor(...COLORS.brandLight)
  doc.setDrawColor(...COLORS.brand)
  doc.roundedRect(badgeX, y - 14, badgeW, 18, 4, 4, 'FD')
  doc.setTextColor(...COLORS.brand)
  doc.text(statusText.toUpperCase(), badgeX + 8, y - 2)

  y += 22
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...COLORS.muted)
  doc.text(`${labels.createdAt}: ${formatDateTime(pr.created_at, locale)}`, MARGIN, y)

  y += 20
  const boxW = (PAGE_W - MARGIN * 2 - 16) / 2
  const leftLines = [
    `${labels.warehouse}: ${pr.warehouse?.name ?? '—'}`,
    pr.outlet?.name ? `${labels.outlet}: ${pr.outlet.name}` : '',
  ].filter(Boolean)
  const rightLines = [`${labels.neededAt}: ${formatDateOnly(pr.needed_at, locale)}`]
  const leftH = drawMetaBox(doc, MARGIN, y, boxW, labels.warehouse, leftLines)
  const rightH = drawMetaBox(doc, MARGIN + boxW + 16, y, boxW, labels.neededAt, rightLines)
  y += Math.max(leftH, rightH) + 16

  if (pr.note) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...COLORS.muted)
    doc.text(labels.note.toUpperCase(), MARGIN, y)
    y += 12
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)
    doc.setTextColor(...COLORS.ink)
    const noteLines = doc.splitTextToSize(pr.note, PAGE_W - MARGIN * 2)
    doc.text(noteLines, MARGIN, y)
    y += noteLines.length * 12 + 12
  }

  const rows: RowInput[] = (pr.items ?? []).map((item) => {
    const name = item.name_snapshot || item.product?.name || '—'
    const sku = item.product?.sku
    const refCost = item.suggested_unit_cost ?? 0
    return [
      sku ? `${name}\n${sku}` : name,
      String(item.qty),
      item.unit ?? '—',
      refCost > 0 ? formatMoney(refCost) : '—',
    ]
  })

  autoTable(doc, {
    startY: y,
    head: [[labels.product, labels.qty, labels.unit, labels.unitCost]],
    body: rows,
    styles: { fontSize: 8.5, cellPadding: 6, textColor: COLORS.ink },
    headStyles: { fillColor: COLORS.brand, textColor: COLORS.white, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { halign: 'right', cellWidth: 48 },
      2: { cellWidth: 56 },
      3: { halign: 'right', cellWidth: 72 },
    },
    theme: 'grid',
    margin: { left: MARGIN, right: MARGIN },
  })

  const tableEnd = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 40

  const signY = tableEnd + 36
  const signW = (PAGE_W - MARGIN * 2 - 20) / 2
  const approvedSteps = (pr.approvals ?? [])
    .filter((row) => row.status === 'approved')
    .sort((a, b) => a.level - b.level)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...COLORS.muted)
  doc.text(labels.createdBy.toUpperCase(), MARGIN, signY)
  doc.text(labels.approvedBy.toUpperCase(), MARGIN + signW + 20, signY)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(...COLORS.ink)
  doc.text(pr.user?.name ?? '—', MARGIN, signY + 16)
  doc.setFontSize(8)
  doc.setTextColor(...COLORS.muted)
  doc.text(formatDateTime(pr.created_at, locale), MARGIN, signY + 30)
  doc.setDrawColor(...COLORS.line)
  doc.line(MARGIN, signY + 42, MARGIN + signW, signY + 42)

  let approverY = signY + 16
  if (approvedSteps.length > 0) {
    approvedSteps.forEach((step) => {
      const levelLabel = labels.approvalLevel.replace('{n}', String(step.level))
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(...COLORS.ink)
      doc.text(`${levelLabel}: ${step.user?.name ?? '—'}`, MARGIN + signW + 20, approverY)
      if (step.acted_at) {
        doc.setFontSize(8)
        doc.setTextColor(...COLORS.muted)
        doc.text(formatDateTime(step.acted_at, locale), MARGIN + signW + 20, approverY + 12)
        approverY += 26
      } else {
        approverY += 16
      }
    })
  } else if (pr.approver?.name) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...COLORS.ink)
    doc.text(pr.approver.name, MARGIN + signW + 20, approverY)
    if (pr.approved_at) {
      doc.setFontSize(8)
      doc.setTextColor(...COLORS.muted)
      doc.text(formatDateTime(pr.approved_at, locale), MARGIN + signW + 20, approverY + 12)
    }
    approverY += 26
  } else {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...COLORS.muted)
    doc.text('—', MARGIN + signW + 20, approverY)
    approverY += 16
  }

  doc.setDrawColor(...COLORS.line)
  doc.line(MARGIN + signW + 20, signY + 42, PAGE_W - MARGIN, signY + 42)

  const footerY = Math.max(820, approverY + 48)
  doc.setDrawColor(...COLORS.line)
  doc.line(MARGIN, footerY - 10, PAGE_W - MARGIN, footerY - 10)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...COLORS.muted)
  doc.text(`${labels.generatedBy} · ${pr.number}`, MARGIN, footerY)
  doc.text(new Date().toLocaleString(locale), PAGE_W - MARGIN, footerY, { align: 'right' })

  doc.save(`${pr.number.replace(/[^\w.-]+/g, '_')}.pdf`)
}
