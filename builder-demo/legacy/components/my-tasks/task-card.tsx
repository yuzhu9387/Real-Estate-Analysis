'use client';
import type { Task } from '@/lib/types';
import { useDemoStore } from '@/lib/store';
import { USERS } from '@/lib/sample-data';
import { PermitChip } from '@/components/shared/permit-chip';
import { StatusBadge } from '@/components/shared/status-badge';
import { Avatar } from '@/components/shared/avatar';
import { PriorityDot } from '@/components/shared/priority-dot';
import { Button } from '@/components/ui/button';
import { getPermit } from '@/lib/permits';
import { TODAY_DAY, dayToDate, formatDateShort } from '@/lib/dates';
import { motion } from 'framer-motion';
import { showCompletionToast } from '@/components/shared/completion-toast';

export function TaskCard({ task, onClick }: { task: Task; onClick?: () => void }) {
  const reviewer = task.reviewerId ? USERS.find(u => u.id === task.reviewerId) : null;
  const p = getPermit(task.phase);
  const overdue = task.plannedDueDay < TODAY_DAY && task.status !== 'Done' && task.status !== 'Approved';
  const submitForReview = useDemoStore((s) => s.submitForReview);
  const setStatus = useDemoStore((s) => s.setStatus);
  const markDone = useDemoStore((s) => s.markDone);

  function primaryAction() {
    if (task.status === 'In Progress')         return <Button size="sm" onClick={(e) => { e.stopPropagation(); submitForReview(task.id); }}>Submit for review</Button>;
    if (task.status === 'Needs Revision')      return <Button size="sm" onClick={(e) => { e.stopPropagation(); submitForReview(task.id); }}>Resubmit</Button>;
    if (task.status === 'Submitted for Review')return <span className="text-xs text-muted-foreground">Awaiting review</span>;
    if (task.status === 'Not Started' || task.status === 'Ready')
      return <Button size="sm" onClick={(e) => { e.stopPropagation(); setStatus(task.id, 'In Progress'); }}>Start</Button>;
    if (task.status === 'Delayed')             return <Button size="sm" variant="destructive" onClick={(e) => { e.stopPropagation(); submitForReview(task.id); }}>Submit for review</Button>;
    return <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); const prev = task.status; markDone(task.id); showCompletionToast(task, prev); }}>Mark done</Button>;
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.25 }}
      onClick={onClick}
      className="cursor-pointer rounded-lg border border-border bg-card p-4 flex flex-col gap-2 hover:shadow-sm"
      style={{ borderLeftWidth: 4, borderLeftColor: p.hex }}
    >
      <div className="flex items-start justify-between">
        <div className="font-medium text-sm leading-snug pr-2">{task.title}</div>
        <PriorityDot priority={task.priority} />
      </div>
      <div className="text-xs text-muted-foreground">9 Greenwood Pl</div>
      <div className="flex items-center gap-2 flex-wrap">
        <PermitChip permit={task.phase} />
        <StatusBadge status={task.status} />
        <span className={`text-xs ${overdue ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
          Due {formatDateShort(dayToDate(task.plannedDueDay))}{overdue && ' · overdue'}
        </span>
      </div>
      {task.reviewComment && (
        <div className="text-xs bg-amber-50 text-amber-900 border border-amber-200 rounded px-2 py-1.5">
          ⚠ {task.reviewComment}
        </div>
      )}
      <div className="flex items-center justify-between pt-1">
        {reviewer ? <span className="text-xs text-muted-foreground flex items-center gap-1">Reviewer <Avatar user={reviewer} size={16} /> {reviewer.name}</span> : <span />}
        {primaryAction()}
      </div>
    </motion.div>
  );
}
