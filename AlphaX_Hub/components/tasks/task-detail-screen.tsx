import { PageNav } from './page-nav'
import { TopActions } from './top-actions'
import { SummarySection } from './summary-section'
import { DetailsSection } from './details-section'
import { CommentsSection } from './comments-section'
import { AttachmentsSection } from './attachments-section'
import type { TaskDetail } from '@/db/queries/task-detail'

type Me = { id: string; role: 'owner' | 'pm' | 'ic' }

export function TaskDetailScreen({ me, detail }: { me: Me; detail: TaskDetail }) {
  return (
    <div className="px-10 py-7 pb-16 max-w-[1360px] mx-auto">
      <PageNav
        projectId={detail.project.id}
        prevTaskId={detail.prevTaskId}
        nextTaskId={detail.nextTaskId}
      />
      <TopActions detail={detail} me={me} />
      <SummarySection detail={detail} me={me} />
      <DetailsSection detail={detail} me={me} />
      <CommentsSection detail={detail} />
      <AttachmentsSection />
    </div>
  )
}
