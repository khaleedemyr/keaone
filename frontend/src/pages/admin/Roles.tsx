import { RolesManager } from '../../components/RolesManager'
import { useI18n } from '../../i18n'

export default function AdminRoles() {
  const { t } = useI18n()
  return <RolesManager endpoint="/roles" eyebrow={t('appAdmin')} subtitle={t('rolesDynamicLead')} />
}
