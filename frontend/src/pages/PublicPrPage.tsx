import { useParams } from 'react-router-dom'
import PublicPrView from './purchase/PublicPrView'

export default function PublicPrPage() {
  const { token } = useParams()
  if (!token) return null
  return <PublicPrView token={token} />
}
