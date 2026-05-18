'use client';
import { useDemoStore } from '@/lib/store';
import { USERS } from '@/lib/sample-data';
import { Avatar } from '@/components/shared/avatar';
import { PermitChip } from '@/components/shared/permit-chip';
import { Button } from '@/components/ui/button';
import { getPermit } from '@/lib/permits';
import type { Task } from '@/lib/types';

export function ReviewCard({ task }: { task: Task }) {
  const owner = USERS.find(u => u.id === task.ownerId)!;
  const p = getPermit(task.phase);
  const approve = useDemoStore((s) => s.approve);
  const requestRevision = useDemoStore((s) => s.requestRevision);
  return (
    <div
      className="rounded-lg border border-border bg-card p-4 space-y-2"
      style={{ borderLeftWidth: 4, borderLeftColor: p.hex }}
    >
      <div className="font-medium text-sm">{task.title}</div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <PermitChip permit={task.phase} /> · submitted by <Avatar user={owner} size={16} /> {owner.name}
      </div>
      <div className="flex gap-2 pt-1">
        <Button size="sm" onClick={() => approve(task.id)}>Approve</Button>
        <Button size="sm" variant="outline" onClick={() => requestRevision(task.id, 'Please clarify the section in question.')}>Request revision</Button>
      </div>
    </div>
  );
}
