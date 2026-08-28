import jsPDF from 'jspdf'
import autoTable, { type RowInput } from 'jspdf-autotable'
import QRCode from 'qrcode'

export type PoExportRow = {
  number: string
  status: string
  supplier?: { name?: string; phone?: string | null } | null
  warehouse?: { name?: string } | null
  expected_at?: string | null
  note?: string | null
  subtotal?: number
  tax_percent?: number
  tax?: number
  total?: number
  payment_term?: string | null
  payment_days?: number | null
  created_at?: string | null
  user?: { name?: string | null } | null
  approver?: { name?: string | null } | null
  approved_at?: string | null
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
    unit_cost?: number
    discount?: number
    total?: number
    note?: string | null
  }>
}

type PoExportLabels = {
  title: string
  number: string
  status: string
  supplier: string
  warehouse: string
  expectedAt: string
  note: string
  product: string
  qty: string
  unit: string
  unitCost: string
  discount: string
  lineTotal: string
  subtotal: string
  grossSubtotal: string
  totalDiscount: string
  tax: string
  total: string
  paymentTerm: string
  createdAt: string
  createdBy: string
  approvedBy: string
  approvalLevel: string
  qrHint: string
  generatedBy: string
}

type PoExportOptions = {
  companyName?: string
  companyPhone?: string
  companyAddress?: string
  statusLabel?: string
  paymentTermLine?: string
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

export async function exportPoPdf(
  po: PoExportRow,
  labels: PoExportLabels,
  formatMoney: (value: number) => string,
  options: PoExportOptions = {},
  locale = 'id-ID',
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  const companyName = options.companyName ?? '—'
  const statusText = options.statusLabel ?? po.status

  const qrDataUrl = await QRCode.toDataURL(po.number, {
    margin: 1,
    width: 240,
    color: { dark: '#0f172a', light: '#ffffff' },
  })

  // Header band
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

  // QR in header (right)
  const qrSize = 68
  const qrX = PAGE_W - MARGIN - qrSize
  const qrY = 14
  doc.setFillColor(...COLORS.white)
  doc.roundedRect(qrX - 6, qrY - 4, qrSize + 12, qrSize + 28, 4, 4, 'F')
  doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize)
  doc.setFontSize(7)
  doc.setTextColor(...COLORS.ink)
  doc.text(po.number, qrX + qrSize / 2, qrY + qrSize + 10, { align: 'center' })
  doc.setFontSize(6)
  doc.setTextColor(...COLORS.muted)
  doc.text(labels.qrHint, qrX + qrSize / 2, qrY + qrSize + 18, { align: 'center', maxWidth: qrSize + 8 })

  let y = 116

  // PO number + status row
  doc.setTextColor(...COLORS.ink)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.text(po.number, MARGIN, y)
  const numberW = doc.getTextWidth(po.number)

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
  doc.text(`${labels.createdAt}: ${formatDateTime(po.created_at, locale)}`, MARGIN, y)

  y += 20
  const boxW = (PAGE_W - MARGIN * 2 - 16) / 2
  const leftLines = [
    `${labels.supplier}: ${po.supplier?.name ?? '—'}`,
    po.supplier?.phone ? `Tel: ${po.supplier.phone}` : '',
    options.paymentTermLine ? `${labels.paymentTerm}: ${options.paymentTermLine}` : '',
  ].filter(Boolean)
  const rightLines = [
    `${labels.warehouse}: ${po.warehouse?.name ?? '—'}`,
    `${labels.expectedAt}: ${formatDateOnly(po.expected_at, locale)}`,
  ]
  const leftH = drawMetaBox(doc, MARGIN, y, boxW, labels.supplier, leftLines)
  const rightH = drawMetaBox(doc, MARGIN + boxW + 16, y, boxW, labels.warehouse, rightLines)
  y += Math.max(leftH, rightH) + 16

  if (po.note) {
    doc.setFillColor(248, 250, 252)
    doc.setDrawColor(...COLORS.line)
    const noteLines = doc.splitTextToSize(`${labels.note}: ${po.note}`, PAGE_W - MARGIN * 2 - 20)
    const noteH = 18 + noteLines.length * 12
    doc.roundedRect(MARGIN, y, PAGE_W - MARGIN * 2, noteH, 4, 4, 'FD')
    doc.setFontSize(9)
    doc.setTextColor(...COLORS.muted)
    doc.text(labels.note.toUpperCase(), MARGIN + 10, y + 14)
    doc.setTextColor(...COLORS.ink)
    doc.text(noteLines, MARGIN + 10, y + 28)
    y += noteH + 14
  }

  const body: RowInput[] = (po.items ?? []).map((item, index) => {
    const name = item.name_snapshot || item.product?.name || '—'
    const sku = item.product?.sku ? `\n${item.product.sku}` : ''
    return [
      { content: `${index + 1}. ${name}${sku}`, styles: { fontStyle: 'bold' } },
      { content: String(item.qty), styles: { halign: 'center' } },
      { content: item.unit ?? '—', styles: { halign: 'center' } },
      { content: formatMoney(item.unit_cost ?? 0), styles: { halign: 'right' } },
      { content: formatMoney(item.discount ?? 0), styles: { halign: 'right' } },
      { content: formatMoney(item.total ?? 0), styles: { halign: 'right', fontStyle: 'bold' } },
    ]
  })

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [[labels.product, labels.qty, labels.unit, labels.unitCost, labels.discount, labels.lineTotal]],
    body,
    styles: {
      fontSize: 8.5,
      cellPadding: { top: 6, right: 5, bottom: 6, left: 5 },
      textColor: COLORS.ink,
      lineColor: COLORS.line,
      lineWidth: 0.5,
    },
    headStyles: {
      fillColor: COLORS.brand,
      textColor: COLORS.white,
      fontStyle: 'bold',
      fontSize: 8,
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 36 },
      2: { cellWidth: 44 },
      3: { cellWidth: 72 },
      4: { cellWidth: 64 },
      5: { cellWidth: 76 },
    },
    theme: 'grid',
  })

  const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 40
  const totalsW = 200
  const totalsX = PAGE_W - MARGIN - totalsW
  const totalsY = finalY + 18
  const rowH = 18

  const discountTotal = (po.items ?? []).reduce((sum, item) => sum + (item.discount ?? 0), 0)
  const grossSubtotal = (po.subtotal ?? 0) + discountTotal

  const taxLabel =
    po.tax_percent && po.tax_percent > 0 ? `${labels.tax} (${po.tax_percent}%)` : labels.tax
  const totals: [string, string][] = []
  if (discountTotal > 0) {
    totals.push([labels.grossSubtotal, formatMoney(grossSubtotal)])
    totals.push([labels.totalDiscount, `-${formatMoney(discountTotal)}`])
  }
  totals.push([labels.subtotal, formatMoney(po.subtotal ?? 0)])
  totals.push([taxLabel, formatMoney(po.tax ?? 0)])
  totals.push([labels.total, formatMoney(po.total ?? 0)])

  doc.setDrawColor(...COLORS.line)
  doc.setFillColor(...COLORS.white)
  doc.roundedRect(totalsX, totalsY, totalsW, rowH * totals.length + 16, 6, 6, 'FD')

  totals.forEach(([label, value], index) => {
    const rowY = totalsY + 14 + index * rowH
    const isGrand = index === totals.length - 1
    doc.setFont('helvetica', isGrand ? 'bold' : 'normal')
    doc.setFontSize(isGrand ? 11 : 9)
    doc.setTextColor(...(isGrand ? COLORS.brand : COLORS.muted))
    doc.text(label, totalsX + 12, rowY)
    doc.setTextColor(...COLORS.ink)
    doc.text(value, totalsX + totalsW - 12, rowY, { align: 'right' })
    if (index < totals.length - 1) {
      doc.setDrawColor(...COLORS.line)
      doc.line(totalsX + 10, rowY + 6, totalsX + totalsW - 10, rowY + 6)
    }
  })

  const signY = totalsY + rowH * totals.length + 16 + 28
  const signW = (PAGE_W - MARGIN * 2 - 20) / 2
  const approvedSteps = (po.approvals ?? [])
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
  const creatorName = po.user?.name ?? '—'
  doc.text(creatorName, MARGIN, signY + 16)
  doc.setFontSize(8)
  doc.setTextColor(...COLORS.muted)
  doc.text(formatDateTime(po.created_at, locale), MARGIN, signY + 30)

  doc.setDrawColor(...COLORS.line)
  doc.line(MARGIN, signY + 42, MARGIN + signW, signY + 42)

  let approverY = signY + 16
  if (approvedSteps.length > 0) {
    approvedSteps.forEach((step) => {
      const levelLabel = labels.approvalLevel.replace('{n}', String(step.level))
      const line = `${levelLabel}: ${step.user?.name ?? '—'}`
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(...COLORS.ink)
      doc.text(line, MARGIN + signW + 20, approverY)
      if (step.acted_at) {
        doc.setFontSize(8)
        doc.setTextColor(...COLORS.muted)
        doc.text(formatDateTime(step.acted_at, locale), MARGIN + signW + 20, approverY + 12)
        approverY += 26
      } else {
        approverY += 16
      }
    })
  } else if (po.approver?.name) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...COLORS.ink)
    doc.text(po.approver.name, MARGIN + signW + 20, approverY)
    if (po.approved_at) {
      doc.setFontSize(8)
      doc.setTextColor(...COLORS.muted)
      doc.text(formatDateTime(po.approved_at, locale), MARGIN + signW + 20, approverY + 12)
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
  doc.text(`${labels.generatedBy} · ${po.number}`, MARGIN, footerY)
  doc.text(new Date().toLocaleString(locale), PAGE_W - MARGIN, footerY, { align: 'right' })

  doc.save(`${po.number.replace(/[^\w.-]+/g, '_')}.pdf`)
}
