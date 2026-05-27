'use client'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

export function SearchBox() {
  const router = useRouter()
  const params = useSearchParams()
  const [v, setV] = useState(params.get('q') ?? '')

  useEffect(() => {
    const t = setTimeout(() => {
      const next = new URLSearchParams(params)
      if (v) next.set('q', v)
      else next.delete('q')
      router.push(`?${next.toString()}`)
    }, 200)
    return () => clearTimeout(t)
  }, [v])

  return (
    <input
      value={v}
      onChange={(e) => setV(e.target.value)}
      placeholder="Search projects…"
      className="w-64 rounded border border-zinc-300 bg-white px-3 py-1 text-sm"
    />
  )
}
