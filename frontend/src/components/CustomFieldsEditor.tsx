import type { CustomFieldDefinition } from '../types'
import { useI18n } from '../i18n'

export function CustomFieldsEditor({
  fields,
  values,
  onChange,
}: {
  fields: CustomFieldDefinition[]
  values: Record<string, string | number | boolean | null | undefined>
  onChange: (next: Record<string, string | number | boolean | null>) => void
}) {
  const { t } = useI18n()
  if (fields.length === 0) return null

  function setValue(key: string, value: string | number | boolean | null) {
    const next: Record<string, string | number | boolean | null> = {}
    for (const [k, v] of Object.entries(values)) {
      if (v !== undefined) next[k] = v
    }
    next[key] = value
    onChange(next)
  }

  return (
    <div className="space-y-3 rounded-2xl border border-line bg-fill/40 p-3 sm:col-span-2">
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{t('customFieldsSection')}</div>
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((field) => {
          const value = values[field.key]
          const label = (
            <span>
              {field.label}
              {field.is_required ? <span className="text-rose-300"> *</span> : null}
            </span>
          )

          if (field.type === 'boolean') {
            return (
              <label key={field.key} className="flex items-center gap-2 text-sm text-fg sm:col-span-2">
                <input
                  type="checkbox"
                  checked={Boolean(value)}
                  onChange={(e) => setValue(field.key, e.target.checked)}
                />
                {label}
              </label>
            )
          }

          if (field.type === 'textarea') {
            return (
              <label key={field.key} className="text-sm text-muted sm:col-span-2">
                {label}
                <textarea
                  className="field min-h-24"
                  required={field.is_required}
                  value={value == null ? '' : String(value)}
                  onChange={(e) => setValue(field.key, e.target.value)}
                />
              </label>
            )
          }

          if (field.type === 'select') {
            return (
              <label key={field.key} className="text-sm text-muted">
                {label}
                <select
                  className="field"
                  required={field.is_required}
                  value={value == null ? '' : String(value)}
                  onChange={(e) => setValue(field.key, e.target.value)}
                >
                  <option value="">{t('selectItemType')}</option>
                  {(field.options ?? []).map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            )
          }

          return (
            <label key={field.key} className="text-sm text-muted">
              {label}
              <input
                className="field"
                type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                required={field.is_required}
                value={value == null ? '' : String(value)}
                onChange={(e) =>
                  setValue(
                    field.key,
                    field.type === 'number'
                      ? e.target.value === ''
                        ? null
                        : Number(e.target.value)
                      : e.target.value,
                  )
                }
              />
            </label>
          )
        })}
      </div>
    </div>
  )
}
