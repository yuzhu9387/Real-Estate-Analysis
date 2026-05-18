'use client';
import { useDemoStore } from '@/lib/store';
import { USERS } from '@/lib/sample-data';
import { Avatar } from '@/components/shared/avatar';
import { formatDateLong } from '@/lib/dates';

export function ActivityFeed() {
  const activity = useDemoStore((s) => s.activity);
  const userById = new Map(USERS.map(u => [u.id, u]));
  const sorted = [...activity].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return (
    <ul className="rounded-lg border border-border bg-card divide-y divide-border">
      {sorted.map(ev => {
        const actor = userById.get(ev.actorId)!;
        return (
          <li key={ev.id} className="flex gap-3 p-3">
            <Avatar user={actor} size={28} />
            <div className="flex-1">
              <div className="text-sm">
                <span className="font-medium">{actor.name}</span> <span className="text-muted-foreground">{ev.action}</span>
              </div>
              {ev.comment && <div className="mt-1 text-xs text-muted-foreground border-l-2 border-border pl-2">{ev.comment}</div>}
              <div className="text-[10px] text-muted-foreground mt-1">{formatDateLong(ev.timestamp)}</div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
