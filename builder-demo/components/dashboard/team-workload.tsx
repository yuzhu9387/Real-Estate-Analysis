'use client';
import { USERS } from '@/lib/sample-data';
import { useDemoStore } from '@/lib/store';
import { Avatar } from '@/components/shared/avatar';
import { TODAY_DAY } from '@/lib/dates';

export function TeamWorkload() {
  const tasks = useDemoStore((s) => Object.values(s.tasks));
  const rows = USERS.map(u => {
    const owned = tasks.filter(t => t.ownerId === u.id && t.status !== 'Done' && t.status !== 'Approved');
    const overdue = owned.filter(t => t.plannedDueDay < TODAY_DAY).length;
    const reviewQueue = tasks.filter(t => t.reviewerId === u.id && t.status === 'Submitted for Review').length;
    return { user: u, active: owned.length, overdue, reviewQueue };
  }).sort((a, b) => b.overdue - a.overdue);

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-sm font-medium mb-3">Team workload</div>
      <div className="space-y-2">
        {rows.map(r => (
          <div key={r.user.id} className="flex items-center gap-3 text-sm">
            <Avatar user={r.user} />
            <div className="flex-1">
              <div className="font-medium">{r.user.name}</div>
              <div className="text-xs text-muted-foreground">{r.user.role}</div>
            </div>
            <span className="text-xs text-muted-foreground">Active</span><span className="font-medium tabular-nums">{r.active}</span>
            <span className="text-xs text-muted-foreground">Overdue</span>
            <span className={`font-medium tabular-nums ${r.overdue > 0 ? 'text-red-600' : ''}`}>{r.overdue}</span>
            <span className="text-xs text-muted-foreground">Review</span><span className="font-medium tabular-nums">{r.reviewQueue}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
