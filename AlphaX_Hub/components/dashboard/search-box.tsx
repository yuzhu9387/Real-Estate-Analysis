'use client'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

export function SearchBox() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const initialQ = params.get('q') ?? ''
  const [v, setV] = useState(initialQ)
  const skipFirst = useRef(true)

  useEffect(() => {
    if (skipFirst.current) {
      skipFirst.current = false
      return
    }
    const t = setTimeout(() => {
      const next = new URLSearchParams(params)
      if (v) next.set('q', v)
      else next.delete('q')
      const qs = next.toString()
      const targetPath = v && pathname !== '/' ? '/' : pathname
      router.push(`${targetPath}${qs ? `?${qs}` : ''}`)
    }, 200)
    return () => clearTimeout(t)
  }, [v])

  return (
    <div className="relative w-full max-w-md focus-within:ring-1 focus-within:ring-primary/50 rounded-lg transition-all">
      <span className="material-symbols-outlined absolute left-md top-1/2 -translate-y-1/2 text-outline pointer-events-none">
        search
      </span>
      <input
        value={v}
        onChange={(e) => setV(e.target.value)}
        placeholder="Search projects..."
        type="text"
        className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg py-sm pl-xl pr-md text-on-surface placeholder:text-outline/50 focus:outline-none focus:border-primary/50 transition-colors"
      />
    </div>
  )
}
