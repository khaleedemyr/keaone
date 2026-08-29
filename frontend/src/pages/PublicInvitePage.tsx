import { useParams } from 'react-router-dom'
import PublicInviteView from './hr/PublicInviteView'

export default function PublicInvitePage() {
  const { token } = useParams()
  if (!token) return null
  return <PublicInviteView token={token} />
}
