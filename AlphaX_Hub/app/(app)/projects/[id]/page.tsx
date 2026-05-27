import { notFound } from 'next/navigation'
import { db } from '@/db/client'
import { getProjectPageData } from '@/db/queries/project-page'
import { HeaderSummary } from '@/components/project/header-summary'
import { Tabs, type TabId } from '@/components/project/tabs'
import { PhaseContent } from '@/components/project/phase-content'
import { ActivityFeed } from '@/components/project/activity-feed'
import { TaskDrawer } from '@/components/project/task-drawer'

const VALID_TABS: TabId[] = ['permitting', 'construction', 'sale', 'activity']

export default async function ProjectDetailPage({
  params, searchParams,
}: {
  params: { id: string }
  searchParams: { tab?: string; task?: string }
}) {
  const data = await getProjectPageData(db, params.id)
  if (!data) notFound()

  const pmUser = data.users.find(u => u.id === data.project.pmId)
  const requestedTab = (VALID_TABS as readonly string[]).includes(searchParams.tab ?? '')
    ? (searchParams.tab as TabId)
    : null
  const defaultTab: TabId = (
    data.phases.find(p => p.status === 'in_progress')?.name.toLowerCase()
    ?? data.phases.find(p => p.status === 'pending')?.name.toLowerCase()
    ?? 'permitting'
  ) as TabId
  const tab: TabId = requestedTab ?? defaultTab

  return (
    <div className="space-y-4">
      <HeaderSummary project={data.project} pm={pmUser} />
      <Tabs current={tab} />

      {tab === 'activity' ? (
        <ActivityFeed projectId={data.project.id} />
      ) : (
        <PhaseContent
          phaseName={tab === 'permitting' ? 'Permitting' : tab === 'construction' ? 'Construction' : 'Sale'}
          data={data}
        />
      )}

      {searchParams.task && (
        <TaskDrawer projectId={data.project.id} taskId={searchParams.task} initialData={data} />
      )}
    </div>
  )
}
