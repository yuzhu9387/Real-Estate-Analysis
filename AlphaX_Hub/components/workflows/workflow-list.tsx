'use client'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import type { WorkflowTemplateListItem } from '@/db/queries/workflow-templates'
import {
  PRODUCT_TYPES,
  PRODUCT_TYPE_LABELS,
  productTypeGroup,
  formatProductType,
  type ProductType,
} from '@/lib/workflows/product-types'

const PAGE_SIZE = 25

type SortKey = 'updated' | 'name' | 'used' | 'tasks' | 'duration'

export function WorkflowList({ items }: { items: WorkflowTemplateListItem[] }) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'all' | 'active' | 'archived'>('all')
  const [owner, setOwner] = useState<string>('all')
  const [productType, setProductType] = useState<'all' | ProductType>('all')
  const [sortBy, setSortBy] = useState<SortKey>('updated')
  const [visible, setVisible] = useState(PAGE_SIZE)

  const owners = useMemo(() => {
    const set = new Set<string>()
    for (const w of items) if (w.ownerName) set.add(w.ownerName)
    return Array.from(set).sort()
  }, [items])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = items.filter((w) => {
      const hay = `${w.name} ${w.description ?? ''} ${w.ownerName ?? ''} ${
        w.productType ? PRODUCT_TYPE_LABELS[w.productType] : ''
      }`.toLowerCase()
      if (q && !hay.includes(q)) return false
      if (status === 'active' && w.isArchived) return false
      if (status === 'archived' && !w.isArchived) return false
      if (owner !== 'all' && w.ownerName !== owner) return false
      if (productType !== 'all' && w.productType !== productType) return false
      return true
    })
    list.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name)
        case 'used':
          return b.usedCount - a.usedCount
        case 'tasks':
          return b.taskCount - a.taskCount
        case 'duration':
          return b.totalDurationDays - a.totalDurationDays
        case 'updated':
        default:
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      }
    })
    return list
  }, [items, query, status, owner, productType, sortBy])

  const shown = filtered.slice(0, visible)
  const canLoadMore = filtered.length > visible

  return (
    <div className="space-y-md">
      <div className="rounded-xl border border-outline-variant/30 bg-white p-md shadow-sm grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[1fr_140px_200px_180px_180px] gap-sm">
        <div className="relative">
          <span className="material-symbols-outlined absolute left-sm top-1/2 -translate-y-1/2 text-outline pointer-events-none text-[18px]">
            search
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setVisible(PAGE_SIZE)
            }}
            placeholder="Search workflow templates..."
            className="w-full h-10 rounded-lg border border-outline-variant/30 bg-white pl-[38px] pr-md text-body-sm focus:outline-none focus:border-primary transition-colors"
          />
        </div>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as 'all' | 'active' | 'archived')
            setVisible(PAGE_SIZE)
          }}
          className="glacier-select h-10 rounded-lg border border-outline-variant/30 bg-white px-sm text-body-sm focus:outline-none focus:border-primary transition-colors"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="archived">Archived</option>
        </select>
        <select
          value={productType}
          onChange={(e) => {
            setProductType((e.target.value || 'all') as 'all' | ProductType)
            setVisible(PAGE_SIZE)
          }}
          className="glacier-select h-10 rounded-lg border border-outline-variant/30 bg-white px-sm text-body-sm focus:outline-none focus:border-primary transition-colors"
        >
          <option value="all">All Product Types</option>
          {(['ADU', 'Alera', 'AL Homes'] as const).map((group) => (
            <optgroup key={group} label={group}>
              {PRODUCT_TYPES.filter((t) => productTypeGroup(t) === group).map((t) => (
                <option key={t} value={t}>
                  {PRODUCT_TYPE_LABELS[t]}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <select
          value={owner}
          onChange={(e) => {
            setOwner(e.target.value)
            setVisible(PAGE_SIZE)
          }}
          className="glacier-select h-10 rounded-lg border border-outline-variant/30 bg-white px-sm text-body-sm focus:outline-none focus:border-primary transition-colors"
        >
          <option value="all">All Owners</option>
          {owners.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortKey)}
          className="glacier-select h-10 rounded-lg border border-outline-variant/30 bg-white px-sm text-body-sm focus:outline-none focus:border-primary transition-colors"
        >
          <option value="updated">Sort: Last Updated</option>
          <option value="name">Sort: Name</option>
          <option value="used">Sort: Most Used</option>
          <option value="tasks">Sort: Task Count</option>
          <option value="duration">Sort: Duration</option>
        </select>
      </div>

      <div className="flex items-center justify-between text-body-sm text-on-surface-variant px-xs">
        <span>
          Showing <strong className="text-on-surface">{shown.length}</strong> of{' '}
          <strong className="text-on-surface">{filtered.length}</strong> workflow template
          {filtered.length === 1 ? '' : 's'}
        </span>
      </div>

      {shown.length === 0 ? (
        <div className="rounded-xl border border-dashed border-outline-variant/40 bg-white/60 p-xl text-center text-body-sm text-on-surface-variant">
          {query.trim()
            ? <>No templates match &ldquo;{query.trim()}&rdquo;.</>
            : <>No templates yet. Click &ldquo;+ New Template&rdquo; to start.</>}
        </div>
      ) : (
        <div className="flex flex-col gap-sm">
          {shown.map((w) => (
            <WorkflowRow key={w.id} item={w} />
          ))}
        </div>
      )}

      <Link
        href="/workflows/new"
        className="block rounded-xl border-2 border-dashed border-outline-variant/40 bg-white/50 py-lg text-center font-bold text-label-caps font-label-caps text-on-surface-variant hover:border-primary hover:text-primary hover:bg-primary/5 transition-all"
      >
        + ADD NEW TEMPLATE
      </Link>

      {canLoadMore && (
        <div className="flex justify-center pt-md">
          <button
            type="button"
            onClick={() => setVisible((v) => v + PAGE_SIZE)}
            className="rounded-lg border border-outline-variant/30 bg-white px-lg py-sm text-body-sm font-bold text-on-surface hover:border-primary hover:text-primary transition-colors"
          >
            Load More
          </button>
        </div>
      )}
    </div>
  )
}

function WorkflowRow({ item: w }: { item: WorkflowTemplateListItem }) {
  return (
    <article className="rounded-xl border border-outline-variant/30 bg-white px-lg py-md shadow-sm hover:border-outline-variant/60 hover:shadow-md hover:-translate-y-px transition-all grid grid-cols-1 md:grid-cols-[1fr_auto] gap-md">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-sm mb-xs">
          <Link
            href={`/workflows/${w.id}`}
            className="font-bold text-body-md text-on-surface hover:text-primary transition-colors"
          >
            {w.name}
          </Link>
          {w.isArchived ? (
            <Badge variant="archived">Archived</Badge>
          ) : (
            <Badge variant="active">Active</Badge>
          )}
          {w.productType && (
            <span
              className="inline-flex items-center h-[22px] px-sm rounded-full border border-tertiary/30 bg-tertiary/10 text-tertiary text-[10px] font-bold uppercase tracking-wide"
              title={PRODUCT_TYPE_LABELS[w.productType]}
            >
              {productTypeGroup(w.productType)}
            </span>
          )}
        </div>
        {w.description && (
          <p className="text-body-sm text-on-surface-variant mb-sm leading-snug max-w-3xl">
            {w.description}
          </p>
        )}
        <div className="flex flex-wrap gap-xs text-[12px] text-on-surface-variant">
          {w.productType && (
            <MetaChip>
              <span className="text-outline">Type:</span>{' '}
              <strong className="text-on-surface">{formatProductType(w.productType)}</strong>
            </MetaChip>
          )}
          <MetaChip>
            <strong className="text-on-surface">{w.taskCount}</strong> tasks
          </MetaChip>
          <MetaChip>
            <strong className="text-on-surface">{w.totalDurationDays}</strong> days
          </MetaChip>
          <MetaChip>
            Used by <strong className="text-on-surface">{w.usedCount}</strong> projects
          </MetaChip>
        </div>
      </div>
      <div className="flex items-center gap-xs whitespace-nowrap">
        <Link
          href={`/workflows/${w.id}`}
          className="h-8 px-sm rounded-lg border border-outline-variant/40 bg-white text-body-sm font-semibold text-on-surface-variant hover:border-primary hover:text-primary transition-colors inline-flex items-center"
        >
          View
        </Link>
        <Link
          href={`/workflows/${w.id}/edit`}
          className="h-8 px-sm rounded-lg border border-outline-variant/40 bg-white text-body-sm font-semibold text-on-surface-variant hover:border-primary hover:text-primary transition-colors inline-flex items-center"
        >
          Edit
        </Link>
      </div>
    </article>
  )
}

function Badge({
  children,
  variant,
}: {
  children: React.ReactNode
  variant: 'active' | 'archived' | 'draft'
}) {
  const variants: Record<string, string> = {
    active: 'bg-secondary/10 text-secondary border-secondary/20',
    archived: 'bg-surface-container text-outline border-outline-variant/40',
    draft: 'bg-surface-container text-outline border-outline-variant/40',
  }
  return (
    <span
      className={`inline-flex items-center h-[22px] px-sm rounded-full border text-[10px] font-bold uppercase tracking-wide ${variants[variant]}`}
    >
      {children}
    </span>
  )
}

function MetaChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="bg-surface-container-low border border-outline-variant/20 px-sm py-xs rounded-lg">
      {children}
    </span>
  )
}

