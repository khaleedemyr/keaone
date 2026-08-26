import { RolesManager } from '../../components/RolesManager'
import { useI18n } from '../../i18n'

export default function PlatformRoles() {
  const { t } = useI18n()
  return (
    <RolesManager endpoint="/platform/roles" eyebrow={t('appAdmin')} subtitle={t('platformRolesDynamicLead')} />
  )
}
