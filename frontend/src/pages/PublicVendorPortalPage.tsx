import { useParams } from 'react-router-dom'
import PublicVendorPortalView from './purchase/PublicVendorPortalView'

export default function PublicVendorPortalPage() {
  const { token } = useParams()
  if (!token) return null
  return <PublicVendorPortalView token={token} />
}
