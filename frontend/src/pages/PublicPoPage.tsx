import { useParams } from 'react-router-dom'
import PublicPoView from './purchase/PublicPoView'

export default function PublicPoPage() {
  const { token } = useParams()
  if (!token) return null
  return <PublicPoView token={token} />
}
