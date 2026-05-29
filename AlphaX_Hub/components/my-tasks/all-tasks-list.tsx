'use client'
import { useState } from 'react'
import type { TaskWithContext } from '@/db/queries/my-tasks'
import type { User } from '@/db/schema'
import { OpenTaskCard } from './task-row'
import { EmptyState } from './empty-state'

const PAGE_SIZE = 25

type SerializableUser = Pick<User, 'id' | 'name' | 'role' | 'team' | 'avatarUrl'>

export function AllTasksList({
  items,
  todayDayOffset,
  owners,
}: {
  items: TaskWithContext[]
  todayDayOffset: number
  owners: SerializableUser[]
}) {
  const [visible, setVisible] = useState(PAGE_SIZE)
  const shown = items.slice(0, visible)
  const canLoadMore = items.length > visible

  // Rehydrate the Map; we can't pass a Map across the server/client boundary directly.
  const ownerById = new Map(owners.map((u) => [u.id, u as User]))

  if (items.length === 0) {
    return <EmptyState message="No open tasks. Nice work." icon="check_circle" />
  }

  return (
    <div className="space-y-md">
      <div className="flex flex-col gap-sm">
        {shown.map((x) => (
          <OpenTaskCard
            key={x.task.id}
            item={x}
            todayDayOffset={todayDayOffset}
            ownerUser={ownerById.get(x.task.ownerId) ?? null}
          />
        ))}
      </div>

      <div className="flex items-center justify-between text-body-sm text-on-surface-variant px-xs">
        <span>
          Showing <strong className="text-on-surface">{shown.length}</strong> of{' '}
          <strong className="text-on-surface">{items.length}</strong>
        </span>
        {canLoadMore && (
          <button
            type="button"
            onClick={() => setVisible((v) => v + PAGE_SIZE)}
            className="rounded-lg border border-outline-variant/30 bg-white px-lg py-sm text-body-sm font-bold text-on-surface hover:border-primary hover:text-primary transition-colors"
          >
            Load More
          </button>
        )}
      </div>
    </div>
  )
}
