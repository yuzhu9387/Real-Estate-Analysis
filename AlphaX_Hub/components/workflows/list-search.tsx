'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export function ListSearch() {
  const router = useRouter()
  const params = useSearchParams()
  const initial = params.get('q') ?? ''
  const [value, setValue] = useState(initial)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const next = new URLSearchParams(params.toString())
      if (value.trim().length === 0) next.delete('q')
      else next.set('q', value.trim())
      router.replace(`/workflows?${next.toString()}`)
    }, 200)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  return (
    <input
      type="search"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      placeholder="Search workflows…"
      className="w-full max-w-sm border border-zinc-200 rounded px-3 py-1.5 text-sm focus:border-blue-400 outline-none"
      aria-label="search workflows"
    />
  )
}
