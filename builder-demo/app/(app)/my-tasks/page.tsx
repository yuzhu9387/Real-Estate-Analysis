import { requireUser } from '@/lib/server/get-current-user'
import { db } from '@/db/client'
import { getMyTasks } from '@/db/queries/my-tasks'
import { computeBannerCounts } from '@/lib/my-tasks/banner-counts'
import { Banner } from '@/components/my-tasks/banner'
import { MyTasksTabs, type MyTabId } from '@/components/my-tasks/my-tasks-tabs'
import { TaskRow } from '@/components/my-tasks/task-row'
import { EmptyState } from '@/components/my-tasks/empty-state'

const VALID_TABS: MyTabId[] = ['open', 'pending_review', 'completed']

export default async function MyTasksPage({
  searchParams,
}: { searchParams: { tab?: string; offset?: string } }) {
  const me = await requireUser()
  const offset = Number(searchParams.offset ?? '0') || 0
  const data = await getMyTasks(db, me.id, { completedOffset: offset })
  const tab: MyTabId = (VALID_TABS as string[]).includes(searchParams.tab ?? '')
    ? (searchParams.tab as MyTabId)
    : 'open'

  const banner = computeBannerCounts(
    data.openTasks.map(x => ({
      status: x.task.status, isBlocked: x.task.isBlocked, plannedEndDay: x.task.plannedEndDay,
    })),
    data.todayDayOffset,
  )

  // For Pending Review variant we need owner User objects to show avatars
  const { users } = await import('@/db/schema')
  const { inArray } = await import('drizzle-orm')
  const ownerIds = Array.from(new Set(data.pendingReview.map(x => x.task.ownerId)))
  const ownerUsers = ownerIds.length === 0
    ? []
    : await db.select().from(users).where(inArray(users.id, ownerIds))
  const ownerById = new Map(ownerUsers.map(u => [u.id, u]))

  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-semibold">My Tasks</h1>
      <Banner counts={banner} />
      <MyTasksTabs
        current={tab}
        counts={{ open: data.openTasks.length, pending_review: data.pendingReview.length, completed: null }}
      />
      <div className="rounded-lg border border-zinc-200 bg-white">
        {tab === 'open' && (
          data.openTasks.length === 0
            ? <EmptyState message="No open tasks. Nice work." />
            : data.openTasks.map(x => <TaskRow key={x.task.id} item={x} todayDayOffset={data.todayDayOffset} variant="open" />)
        )}
        {tab === 'pending_review' && (
          data.pendingReview.length === 0
            ? <EmptyState message="No tasks waiting for your review." />
            : data.pendingReview.map(x => (
                <TaskRow key={x.task.id} item={x} todayDayOffset={data.todayDayOffset}
                  variant="pending_review" owner={ownerById.get(x.task.ownerId)} />
              ))
        )}
        {tab === 'completed' && (
          <>
            {data.completedTasks.length === 0
              ? <EmptyState message="No completed tasks yet." />
              : data.completedTasks.map(x => <TaskRow key={x.task.id} item={x} todayDayOffset={data.todayDayOffset} variant="completed" />)}
            {data.completedTotal > offset + data.completedTasks.length && (
              <div className="p-3 text-center">
                <a href={`?tab=completed&offset=${offset + 100}`} className="text-blue-600 text-sm hover:underline">
                  Show older →
                </a>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
