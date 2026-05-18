'use client';
import { useDemoStore } from '@/lib/store';
import { PermitChip } from '@/components/shared/permit-chip';
import { dayToDate, formatDateShort } from '@/lib/dates';
import { Check } from 'lucide-react';

export function HistoryList() {
  const currentUserId = useDemoStore((s) => s.currentUserId);
  const tasks = useDemoStore((s) => Object.values(s.tasks))
    .filter(t => t.ownerId === currentUserId && (t.status === 'Done' || t.status === 'Approved'))
    .sort((a, b) => (b.actualEndDay ?? 0) - (a.actualEndDay ?? 0));
  if (tasks.length === 0) return <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">No completed tasks yet.</div>;
  return (
    <ul className="rounded-lg border border-border bg-card divide-y divide-border">
      {tasks.map(t => (
        <li key={t.id} className="flex items-center gap-3 p-3 text-sm">
          <span className="text-emerald-600"><Check className="size-4" /></span>
          <span className="flex-1">{t.title}</span>
          <PermitChip permit={t.phase} />
          <span className="text-xs text-muted-foreground tabular-nums">Completed {t.actualEndDay ? formatDateShort(dayToDate(t.actualEndDay)) : '—'}</span>
        </li>
      ))}
    </ul>
  );
}
