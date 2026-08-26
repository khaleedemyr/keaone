import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { ApiOk, BusinessType } from '../types'
import { useI18n } from '../i18n'

export function BusinessTypeField({
  value,
  onChange,
  required = true,
}: {
  value: string
  onChange: (slug: string) => void
  required?: boolean
}) {
  const { t } = useI18n()
  const [types, setTypes] = useState<BusinessType[]>([])

  useEffect(() => {
    void api
      .get<ApiOk<{ business_types: BusinessType[] }>>('/catalog')
      .then(({ data }) => {
        setTypes(data.data.business_types)
        if (!value && data.data.business_types[0]) onChange(data.data.business_types[0].slug)
      })
      .catch(() => setTypes([]))
  }, [])

  return (
    <label className="block text-sm text-muted">
      {t('businessType')}
      <select
        required={required}
        className="field"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {types.length === 0 ? <option value={value || 'retail'}>{value || 'retail'}</option> : null}
        {types.map((item) => (
          <option key={item.slug} value={item.slug}>
            {item.name}
          </option>
        ))}
      </select>
    </label>
  )
}
