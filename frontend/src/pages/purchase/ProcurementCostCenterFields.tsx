import { useI18n } from '../../i18n'

type Option = { id: number; name: string; code?: string | null }

export function ProcurementCostCenterFields({
  departments,
  outlets,
  multiOutlet,
  departmentId,
  outletId,
  onDepartmentChange,
  onOutletChange,
}: {
  departments: Option[]
  outlets: Option[]
  multiOutlet: boolean
  departmentId: string
  outletId: string
  onDepartmentChange: (value: string) => void
  onOutletChange: (value: string) => void
}) {
  const { t } = useI18n()

  return (
    <>
      <label className="block text-sm text-muted">
        {t('navDepartments')}
        <select className="field" value={departmentId} onChange={(e) => onDepartmentChange(e.target.value)}>
          <option value="">{t('procurementCostCenterNoDepartment')}</option>
          {departments.map((row) => (
            <option key={row.id} value={row.id}>
              {row.code ? `${row.name} (${row.code})` : row.name}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-xs">{t('procurementCostCenterDepartmentHint')}</span>
      </label>

      {multiOutlet ? (
        <label className="block text-sm text-muted">
          {t('navOutlets')}
          <select className="field" value={outletId} onChange={(e) => onOutletChange(e.target.value)}>
            <option value="">{t('procurementCostCenterDefaultOutlet')}</option>
            {outlets.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs">{t('procurementCostCenterOutletHint')}</span>
        </label>
      ) : null}
    </>
  )
}
