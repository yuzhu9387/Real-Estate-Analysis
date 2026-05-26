'use client'
import { useRouter, useSearchParams } from 'next/navigation'

const OPTIONS = [
  { value: '', label: 'All Brands' },
  { value: 'al_homes', label: 'Al Homes' },
  { value: 'alera', label: 'Alera' },
  { value: 'apex', label: 'Apex' },
] as const

export function BrandSwitcher() {
  const router = useRouter()
  const params = useSearchParams()
  const current = params.get('brand') ?? ''

  return (
    <select
      value={current}
      onChange={(e) => {
        const next = new URLSearchParams(params)
        if (e.target.value) next.set('brand', e.target.value)
        else next.delete('brand')
        router.push(`?${next.toString()}`)
      }}
      className="rounded border border-slate-300 bg-white px-3 py-1 text-sm"
    >
      {OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}
