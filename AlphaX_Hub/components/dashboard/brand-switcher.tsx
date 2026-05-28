'use client'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'

const OPTIONS = [
  { value: '', label: 'All Brands' },
  { value: 'al_homes', label: 'AL Homes' },
  { value: 'alera', label: 'Alera' },
  { value: 'apex', label: 'Apex' },
] as const

export function BrandSwitcher() {
  const router = useRouter()
  const params = useSearchParams()
  const current = params.get('brand') ?? ''
  const currentLabel = OPTIONS.find((o) => o.value === current)?.label ?? 'All Brands'
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const select = (value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set('brand', value)
    else next.delete('brand')
    router.push(`?${next.toString()}`)
    setOpen(false)
  }

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-sm font-headline-lg text-headline-lg text-on-surface tracking-tight hover:text-primary transition-colors focus:outline-none"
      >
        {currentLabel === 'All Brands' ? 'Dashboard' : currentLabel}
        <span
          className={`material-symbols-outlined transition-transform ${open ? 'rotate-180' : ''}`}
        >
          expand_more
        </span>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-xs w-48 bg-white border border-outline-variant/30 rounded-xl shadow-xl z-50">
          {OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => select(o.value)}
              className={[
                'block w-full text-left px-md py-sm text-on-surface hover:bg-surface-container-low transition-colors',
                o.value === current ? 'font-semibold text-primary' : '',
              ].join(' ')}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
