import { useEffect, useMemo, useState } from 'react'
import { api } from '../../api/client'
import type { ApiOk, Party } from '../../types'
import type { SearchSelectOption } from '../../components/SearchSelect'

export function useSupplierSelect(suppliers: Party[]) {
  const [topIds, setTopIds] = useState<number[]>([])

  useEffect(() => {
    void api
      .get<ApiOk<Party[]>>('/suppliers/top', { params: { limit: 5 }, silent: true })
      .then(({ data }) => setTopIds((data.data ?? []).map((row) => row.id)))
      .catch(() => {})
  }, [])

  const options = useMemo<SearchSelectOption[]>(() => {
    const topSet = new Set(topIds.map(String))
    return [...suppliers]
      .sort((a, b) => {
        const aTop = topSet.has(String(a.id)) ? 0 : 1
        const bTop = topSet.has(String(b.id)) ? 0 : 1
        if (aTop !== bTop) return aTop - bTop
        return a.name.localeCompare(b.name)
      })
      .map((supplier) => ({
        value: String(supplier.id),
        label: supplier.name,
        keywords: `${supplier.phone ?? ''} ${supplier.email ?? ''} ${supplier.city ?? ''}`,
        pinned: topSet.has(String(supplier.id)),
      }))
  }, [suppliers, topIds])

  return { options, topIds }
}
