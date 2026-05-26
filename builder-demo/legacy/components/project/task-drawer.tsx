'use client';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useDemoStore } from '@/lib/store';
import { USERS } from '@/lib/sample-data';
import { StatusBadge } from '@/components/shared/status-badge';
import { PermitChip } from '@/components/shared/permit-chip';
import { Avatar } from '@/components/shared/avatar';
import { ThreeLayerDates } from '@/components/shared/three-layer-dates';
import type { TaskId } from '@/lib/types';
import { showCompletionToast } from '@/components/shared/completion-toast';

export function TaskDrawer({ taskId, onClose }: { taskId: TaskId | null; onClose: () => void }) {
  const task = useDemoStore((s) => (taskId ? s.tasks[taskId] : null));
  const submitForReview = useDemoStore((s) => s.submitForReview);
  const approve = useDemoStore((s) => s.approve);
  const requestRevision = useDemoStore((s) => s.requestRevision);
  const markDone = useDemoStore((s) => s.markDone);
  const setStatus = useDemoStore((s) => s.setStatus);

  if (!task) return null;
  const owner = USERS.find(u => u.id === task.ownerId)!;
  const reviewer = task.reviewerId ? USERS.find(u => u.id === task.reviewerId)! : null;

  return (
    <Sheet open={!!taskId} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent className="w-[480px] sm:max-w-[480px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-start gap-2 pr-6">
            <span className="flex-1">{task.title}</span>
          </SheetTitle>
          <div className="flex items-center gap-2 pt-2">
            <PermitChip permit={task.phase} />
            <StatusBadge status={task.status} />
            {task.isCriticalPath && <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">Critical path</span>}
          </div>
        </SheetHeader>

        <div className="mt-5 space-y-5">
          <ThreeLayerDates
            plannedStart={task.plannedStartDay} plannedDue={task.plannedDueDay}
            forecastStart={task.forecastStartDay} forecastDue={task.forecastDueDay}
            actualStart={task.actualStartDay} actualEnd={task.actualEndDay}
          />

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide">Owner</div>
              <div className="flex items-center gap-2 mt-1"><Avatar user={owner} /> {owner.name}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide">Reviewer</div>
              <div className="flex items-center gap-2 mt-1">
                {reviewer ? <><Avatar user={reviewer} /> {reviewer.name}</> : <span className="text-muted-foreground">—</span>}
              </div>
            </div>
          </div>

          {task.reviewComment && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <div className="font-medium mb-1">Review comment</div>
              {task.reviewComment}
            </div>
          )}

          <div className="space-y-2">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Actions</div>
            <div className="flex flex-wrap gap-2">
              {task.status === 'In Progress' && <Button size="sm" onClick={() => submitForReview(task.id)}>Submit for review</Button>}
              {task.status === 'Submitted for Review' && reviewer && (
                <>
                  <Button size="sm" onClick={() => approve(task.id)}>Approve</Button>
                  <Button size="sm" variant="outline" onClick={() => requestRevision(task.id, 'Please address comments and resubmit.')}>Request revision</Button>
                </>
              )}
              {(task.status === 'Approved' || task.status === 'In Progress' || task.status === 'Needs Revision') &&
                <Button size="sm" variant="outline" onClick={() => { const prev = task.status; markDone(task.id); showCompletionToast(task, prev); }}>Mark done</Button>}
              {task.status === 'Not Started' && <Button size="sm" onClick={() => setStatus(task.id, 'In Progress')}>Start</Button>}
              {task.status === 'Needs Revision' && <Button size="sm" onClick={() => submitForReview(task.id)}>Resubmit for review</Button>}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
