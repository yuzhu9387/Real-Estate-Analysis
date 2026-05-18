'use client';
import { useDemoStore } from '@/lib/store';
import { USERS } from '@/lib/sample-data';
import { TODAY_DAY, dayToDate, formatDateShort } from '@/lib/dates';
import { PermitChip } from '@/components/shared/permit-chip';
import { Avatar } from '@/components/shared/avatar';

export function UpcomingDeadlines() {
  const tasks = Object.values(useDemoStore((s) => s.tasks));
  const userById = new Map(USERS.map(u => [u.id, u]));
  const upcoming = tasks
    .filter(t => t.plannedDueDay >= TODAY_DAY && t.plannedDueDay <= TODAY_DAY + 14 && t.status !== 'Done')
    .sort((a, b) => a.plannedDueDay - b.plannedDueDay)
    .slice(0, 8);

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-sm font-medium mb-3">Upcoming deadlines (next 14 days)</div>
      <ul className="space-y-2">
        {upcoming.map(t => (
          <li key={t.id} className="flex items-center gap-3 text-sm py-1">
            <span className="text-xs text-muted-foreground tabular-nums w-16">{formatDateShort(dayToDate(t.plannedDueDay))}</span>
            <span className="flex-1 truncate">{t.title}</span>
            <PermitChip permit={t.phase} />
            <Avatar user={userById.get(t.ownerId)!} />
          </li>
        ))}
      </ul>
    </div>
  );
}
