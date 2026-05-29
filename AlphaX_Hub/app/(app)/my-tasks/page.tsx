import { inArray } from 'drizzle-orm'
import { requireUser } from '@/lib/server/get-current-user'
import { db } from '@/db/client'
import { getMyTasks } from '@/db/queries/my-tasks'
import { priorityFocusScore } from '@/lib/my-tasks/display'
import { MyTasksTabs, type MyTabId } from '@/components/my-tasks/my-tasks-tabs'
import { ViewToggle, type ViewMode } from '@/components/my-tasks/view-toggle'
import { QuickAdd } from '@/components/my-tasks/quick-add'
import { PriorityFocusCard, CompletedCard } from '@/components/my-tasks/task-row'
import { AllTasksList } from '@/components/my-tasks/all-tasks-list'
import { KanbanView } from '@/components/my-tasks/kanban-view'
import { ReviewCard } from '@/components/my-tasks/review-card'
import { EmptyState } from '@/components/my-tasks/empty-state'
import { users, type User } from '@/db/schema'

const VALID_TABS: MyTabId[] = ['open', 'pending_review', 'completed']
const PRIORITY_FOCUS_LIMIT = 4

export default async function MyTasksPage({
  searchParams,
}: {
  searchParams: { tab?: string; offset?: string; view?: string }
}) {
  const me = await requireUser()
  const offset = Number(searchParams.offset ?? '0') || 0
  const tab: MyTabId = (VALID_TABS as string[]).includes(searchParams.tab ?? '')
    ? (searchParams.tab as MyTabId)
    : 'open'
  const view: ViewMode = searchParams.view === 'kanban' ? 'kanban' : 'list'

  const data = await getMyTasks(db, me.id, { completedOffset: offset })

  // Owner + reviewer lookup map — covers Open + Review tabs.
  const userIds = Array.from(
    new Set([
      ...data.openTasks.map((x) => x.task.ownerId),
      ...data.pendingReview.map((x) => x.task.ownerId),
      ...data.pendingReview.map((x) => x.task.reviewerId).filter((id): id is string => !!id),
    ]),
  )
  const userRows: User[] = userIds.length === 0
    ? []
    : await db.select().from(users).where(inArray(users.id, userIds))
  const userById = new Map(userRows.map((u) => [u.id, u]))

  // Blocked tasks are excluded from Priority Focus entirely — the owner can't act on them,
  // so showing them as "focus" is misleading. They still appear in the All Tasks list (at
  // the bottom, courtesy of rankMyOpenTasks) and in the Blocked column on the Kanban view.
  const priorityFocus = data.openTasks
    .filter((x) => !x.task.isBlocked)
    .sort(
      (a, b) =>
        priorityFocusScore(
          {
            status: b.task.status,
            priority: b.task.priority,
            isBlocked: b.task.isBlocked,
            plannedEndDay: b.task.plannedEndDay,
            isOnCriticalPath: b.task.isOnCriticalPath,
          },
          data.todayDayOffset,
        ) -
        priorityFocusScore(
          {
            status: a.task.status,
            priority: a.task.priority,
            isBlocked: a.task.isBlocked,
            plannedEndDay: a.task.plannedEndDay,
            isOnCriticalPath: a.task.isOnCriticalPath,
          },
          data.todayDayOffset,
        ),
    )
    .slice(0, PRIORITY_FOCUS_LIMIT)

  // Serializable subsets for client components (Map/Date don't cross the RSC boundary).
  const ownersSerializable = userRows.map((u) => ({
    id: u.id, name: u.name, role: u.role, team: u.team, avatarUrl: u.avatarUrl,
  }))

  return (
    <div className="space-y-lg max-w-[1240px] pt-md">
      <h1 className="font-headline-lg text-headline-lg tracking-tight text-on-surface">
        My Tasks
      </h1>

      <QuickAdd currentUserId={me.id} />

      <div className="flex items-center justify-between gap-md">
        <MyTasksTabs
          current={tab}
          counts={{
            open: data.openTasks.length,
            pending_review: data.pendingReview.length,
            completed: data.completedTotal,
          }}
        />
        {tab === 'open' && <ViewToggle current={view} />}
      </div>

      {tab === 'open' && view === 'list' && (
        <div className="space-y-lg">
          {priorityFocus.length > 0 && (
            <section>
              <header className="flex items-center justify-between mb-sm">
                <div className="flex items-center gap-xs">
                  <span className="material-symbols-outlined text-primary">crisis_alert</span>
                  <h2 className="font-headline-md text-headline-md text-on-surface">
                    Priority Focus
                  </h2>
                </div>
                <span className="text-body-sm text-on-surface-variant">
                  Top {priorityFocus.length} most urgent
                </span>
              </header>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-md">
                {priorityFocus.map((x) => (
                  <PriorityFocusCard
                    key={x.task.id}
                    item={x}
                    todayDayOffset={data.todayDayOffset}
                    ownerUser={userById.get(x.task.ownerId) ?? null}
                  />
                ))}
              </div>
            </section>
          )}

          <section>
            <header className="flex items-center justify-between mb-sm">
              <h2 className="font-headline-md text-headline-md text-on-surface">
                All Tasks{' '}
                <span className="ml-xs inline-flex items-center justify-center min-w-[22px] h-[20px] px-xs rounded-full bg-surface-container text-[11px] font-bold text-on-surface-variant align-middle">
                  {data.openTasks.length}
                </span>
              </h2>
            </header>
            <AllTasksList
              items={data.openTasks}
              todayDayOffset={data.todayDayOffset}
              owners={ownersSerializable}
            />
          </section>
        </div>
      )}

      {tab === 'open' && view === 'kanban' && (
        <KanbanView
          items={data.openTasks}
          todayDayOffset={data.todayDayOffset}
          ownerById={userById}
        />
      )}

      {tab === 'pending_review' && (
        data.pendingReview.length === 0 ? (
          <EmptyState message="No tasks under review." icon="rate_review" />
        ) : (
          <div className="flex flex-col gap-sm">
            {data.pendingReview.map((x) => (
              <ReviewCard
                key={x.task.id}
                item={x}
                todayDayOffset={data.todayDayOffset}
                currentUserId={me.id}
                ownerUser={userById.get(x.task.ownerId) ?? null}
                reviewerUser={x.task.reviewerId ? userById.get(x.task.reviewerId) ?? null : null}
              />
            ))}
          </div>
        )
      )}

      {tab === 'completed' && (
        <div className="space-y-md">
          {data.completedTasks.length === 0 ? (
            <EmptyState message="No completed tasks yet." icon="task_alt" />
          ) : (
            <div className="flex flex-col gap-sm">
              {data.completedTasks.map((x) => (
                <CompletedCard key={x.task.id} item={x} />
              ))}
            </div>
          )}
          {data.completedTotal > offset + data.completedTasks.length && (
            <div className="flex justify-center pt-sm">
              <a
                href={`?tab=completed&offset=${offset + 100}`}
                className="rounded-lg border border-outline-variant/30 bg-white px-lg py-sm text-body-sm font-bold text-on-surface hover:border-primary hover:text-primary transition-colors"
              >
                Show older →
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
