import jsPDF from 'jspdf'
import autoTable, { type RowInput } from 'jspdf-autotable'
import type { EngineeringCategory, EngineeringGrandTotal } from '../types'

type ExportLabels = {
  title: string
  period: string
  category: string
  product: string
  qty: string
  discount: string
  revenue: string
  share: string
  subtotal: string
  grandTotal: string
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function share(part: number, total: number) {
  if (!total) return '0%'
  return `${Math.round((part / total) * 100)}%`
}

function downloadBlob(content: BlobPart, mime: string, filename: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function exportEngineeringExcel(
  categories: EngineeringCategory[],
  grandTotal: EngineeringGrandTotal,
  labels: ExportLabels,
  filename: string,
) {
  const rows: string[] = []
  rows.push('<Row>')
  rows.push(`<Cell><Data ss:Type="String">${escapeXml(labels.title)}</Data></Cell>`)
  rows.push('</Row>')
  rows.push('<Row>')
  rows.push(`<Cell><Data ss:Type="String">${escapeXml(labels.period)}</Data></Cell>`)
  rows.push('</Row>')
  rows.push('<Row></Row>')
  rows.push('<Row>')
  for (const header of [labels.category, labels.product, labels.qty, labels.discount, labels.revenue, labels.share]) {
    rows.push(`<Cell><Data ss:Type="String">${escapeXml(header)}</Data></Cell>`)
  }
  rows.push('</Row>')

  for (const category of categories) {
    for (const product of category.products) {
      rows.push('<Row>')
      rows.push(`<Cell><Data ss:Type="String">${escapeXml(category.category_name)}</Data></Cell>`)
      rows.push(`<Cell><Data ss:Type="String">${escapeXml(product.name)}</Data></Cell>`)
      rows.push(`<Cell><Data ss:Type="Number">${product.qty}</Data></Cell>`)
      rows.push(`<Cell><Data ss:Type="Number">${product.discount}</Data></Cell>`)
      rows.push(`<Cell><Data ss:Type="Number">${product.revenue}</Data></Cell>`)
      rows.push(`<Cell><Data ss:Type="String">${share(product.revenue, grandTotal.revenue)}</Data></Cell>`)
      rows.push('</Row>')
    }
    rows.push('<Row>')
    rows.push(`<Cell ss:StyleID="subtotal"><Data ss:Type="String">${escapeXml(`${labels.subtotal}: ${category.category_name}`)}</Data></Cell>`)
    rows.push('<Cell></Cell>')
    rows.push(`<Cell ss:StyleID="subtotal"><Data ss:Type="Number">${category.qty}</Data></Cell>`)
    rows.push(`<Cell ss:StyleID="subtotal"><Data ss:Type="Number">${category.discount}</Data></Cell>`)
    rows.push(`<Cell ss:StyleID="subtotal"><Data ss:Type="Number">${category.revenue}</Data></Cell>`)
    rows.push(`<Cell ss:StyleID="subtotal"><Data ss:Type="String">${share(category.revenue, grandTotal.revenue)}</Data></Cell>`)
    rows.push('</Row>')
  }

  rows.push('<Row></Row>')
  rows.push('<Row>')
  rows.push(`<Cell ss:StyleID="total"><Data ss:Type="String">${escapeXml(labels.grandTotal)}</Data></Cell>`)
  rows.push('<Cell></Cell>')
  rows.push(`<Cell ss:StyleID="total"><Data ss:Type="Number">${grandTotal.qty}</Data></Cell>`)
  rows.push(`<Cell ss:StyleID="total"><Data ss:Type="Number">${grandTotal.discount}</Data></Cell>`)
  rows.push(`<Cell ss:StyleID="total"><Data ss:Type="Number">${grandTotal.revenue}</Data></Cell>`)
  rows.push(`<Cell ss:StyleID="total"><Data ss:Type="String">100%</Data></Cell>`)
  rows.push('</Row>')

  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles>
 <Style ss:ID="subtotal"><Font ss:Bold="1"/></Style>
 <Style ss:ID="total"><Font ss:Bold="1"/></Style>
</Styles>
<Worksheet ss:Name="Report">
<Table>
${rows.join('\n')}
</Table>
</Worksheet>
</Workbook>`

  downloadBlob(`\uFEFF${xml}`, 'application/vnd.ms-excel', `${filename}.xls`)
}

export function exportEngineeringPdf(
  categories: EngineeringCategory[],
  grandTotal: EngineeringGrandTotal,
  labels: ExportLabels,
  filename: string,
  formatMoney: (value: number) => string,
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  doc.setFontSize(14)
  doc.text(labels.title, 40, 36)
  doc.setFontSize(10)
  doc.text(labels.period, 40, 52)

  const body: RowInput[] = []
  for (const category of categories) {
    for (const product of category.products) {
      body.push([
        category.category_name,
        product.name,
        product.qty,
        formatMoney(product.discount),
        formatMoney(product.revenue),
        share(product.revenue, grandTotal.revenue),
      ])
    }
    body.push([
      {
        content: `${labels.subtotal}: ${category.category_name}`,
        colSpan: 2,
        styles: { fontStyle: 'bold', fillColor: [245, 245, 245] },
      },
      category.qty,
      formatMoney(category.discount),
      formatMoney(category.revenue),
      share(category.revenue, grandTotal.revenue),
    ])
  }

  autoTable(doc, {
    startY: 64,
    head: [[labels.category, labels.product, labels.qty, labels.discount, labels.revenue, labels.share]],
    body,
    foot: [[
      labels.grandTotal,
      '',
      grandTotal.qty,
      formatMoney(grandTotal.discount),
      formatMoney(grandTotal.revenue),
      '100%',
    ]],
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [30, 41, 59] },
    footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
    theme: 'grid',
  })

  doc.save(`${filename}.pdf`)
}
