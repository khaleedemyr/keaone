import type { MsgKey } from '../../i18n'
import { formatRupiah } from '../../lib/money'

type ExceptionLike = {
  exception_type: string
  field_name?: string | null
  expected_value?: string | null
  actual_value?: string | null
  goods_receipt_item_id?: number | null
  message?: string | null
}

function fmtValue(fieldName: string | null | undefined, raw: string | null | undefined, locale: string) {
  if (raw == null || raw === '') return '—'
  if (fieldName === 'unit_cost') return formatRupiah(Number(raw), locale)
  return raw
}

export function matchExceptionDetail(
  row: ExceptionLike,
  t: (key: MsgKey, vars?: Record<string, string>) => string,
  locale: string,
): string {
  const expected = fmtValue(row.field_name, row.expected_value, locale)
  const actual = fmtValue(row.field_name, row.actual_value, locale)

  switch (row.exception_type) {
    case 'missing_po':
      return t('procurementMatchMsgMissingPo')
    case 'missing_gr':
      return t('procurementMatchMsgMissingGr')
    case 'price':
      return t('procurementMatchMsgPricePo', { actual, expected })
    case 'qty':
      if (row.goods_receipt_item_id) {
        return t('procurementMatchMsgQtyGr', { actual, expected })
      }
      return t('procurementMatchMsgQtyPo', { actual, expected })
    default:
      return row.message ?? t('procurementMatchTypeOther')
  }
}
