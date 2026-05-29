import type { TaskWithContext } from '@/db/queries/my-tasks'
import type { User } from '@/db/schema'
import { KanbanCard } from './task-row'
import { deriveDisplayStatus, type DisplayStatus } from '@/lib/my-tasks/display'

type ColumnDef = {
  id: Exclude<DisplayStatus, 'completed'>
  label: string
  dotClass: string
}

const COLUMNS: ColumnDef[] = [
  { id: 'not_started', label: 'Not Started', dotClass: 'bg-outline-variant' },
  { id: 'in_progress', label: 'In Progress', dotClass: 'bg-tertiary' },
  { id: 'under_review', label: 'Under Review', dotClass: 'bg-tertiary' },
  { id: 'blocked', label: 'Blocked', dotClass: 'bg-error' },
]

export function KanbanView({
  items,
  todayDayOffset,
  ownerById,
}: {
  items: TaskWithContext[]
  todayDayOffset: number
  ownerById: Map<string, User>
}) {
  const grouped = new Map<DisplayStatus, TaskWithContext[]>()
  for (const c of COLUMNS) grouped.set(c.id, [])
  for (const item of items) {
    const ds = deriveDisplayStatus({ status: item.task.status, isBlocked: item.task.isBlocked })
    if (ds === 'completed') continue
    grouped.get(ds)!.push(item)
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-md">
      {COLUMNS.map((col) => {
        const colItems = grouped.get(col.id) ?? []
        return (
          <section
            key={col.id}
            className="rounded-xl border border-outline-variant/30 bg-surface-container-low/50 p-sm min-h-[400px]"
          >
            <header className="flex items-center gap-xs px-xs pb-sm border-b border-outline-variant/20 mb-sm">
              <span className={`inline-block w-2 h-2 rounded-full ${col.dotClass}`} />
              <span className="text-body-sm font-bold text-on-surface">{col.label}</span>
              <span className="ml-auto inline-flex items-center justify-center min-w-[22px] h-[20px] px-xs rounded-full bg-surface-container text-[11px] font-bold text-on-surface-variant">
                {colItems.length}
              </span>
            </header>

            {colItems.length === 0 ? (
              <p className="px-xs py-md text-center text-[12px] text-outline">No tasks.</p>
            ) : (
              <div className="flex flex-col gap-sm">
                {colItems.map((item) => (
                  <KanbanCard
                    key={item.task.id}
                    item={item}
                    todayDayOffset={todayDayOffset}
                    ownerUser={ownerById.get(item.task.ownerId) ?? null}
                  />
                ))}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
