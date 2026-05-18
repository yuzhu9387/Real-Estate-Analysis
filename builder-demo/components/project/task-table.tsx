'use client';
import { useState } from 'react';
import { useDemoStore } from '@/lib/store';
import { USERS } from '@/lib/sample-data';
import { dayToDate, formatDateShort } from '@/lib/dates';
import { StatusBadge } from '@/components/shared/status-badge';
import { PermitChip } from '@/components/shared/permit-chip';
import { Avatar } from '@/components/shared/avatar';
import { PriorityDot } from '@/components/shared/priority-dot';
import { TaskDrawer } from './task-drawer';
import type { TaskId } from '@/lib/types';

export function TaskTable() {
  const tasks = useDemoStore((s) => Object.values(s.tasks));
  const userById = new Map(USERS.map(u => [u.id, u]));
  const [openId, setOpenId] = useState<TaskId | null>(null);

  return (
    <>
      <div className="rounded-lg border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Task</th>
              <th className="text-left px-3 py-2 font-medium">Phase</th>
              <th className="text-left px-3 py-2 font-medium">Status</th>
              <th className="text-left px-3 py-2 font-medium">Owner</th>
              <th className="text-left px-3 py-2 font-medium">Reviewer</th>
              <th className="text-left px-3 py-2 font-medium">Planned</th>
              <th className="text-left px-3 py-2 font-medium">Forecast</th>
              <th className="text-left px-3 py-2 font-medium">Δ</th>
              <th className="text-left px-3 py-2 font-medium">Pri</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map(t => {
              const slip = t.forecastDueDay - t.plannedDueDay;
              return (
                <tr key={t.id} className="border-t border-border hover:bg-accent/30 cursor-pointer" onClick={() => setOpenId(t.id)}>
                  <td className="px-3 py-2"><span className="font-medium">{t.title}</span>{t.source === 'unplanned' && <span className="ml-2 text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">Unplanned</span>}</td>
                  <td className="px-3 py-2"><PermitChip permit={t.phase} /></td>
                  <td className="px-3 py-2"><StatusBadge status={t.status} /></td>
                  <td className="px-3 py-2"><div className="flex items-center gap-1.5"><Avatar user={userById.get(t.ownerId)!} size={18} /><span className="text-xs">{userById.get(t.ownerId)!.name}</span></div></td>
                  <td className="px-3 py-2">{t.reviewerId ? <Avatar user={userById.get(t.reviewerId)!} size={18} /> : <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-3 py-2 tabular-nums">{formatDateShort(dayToDate(t.plannedDueDay))}</td>
                  <td className="px-3 py-2 tabular-nums">{formatDateShort(dayToDate(t.forecastDueDay))}</td>
                  <td className={`px-3 py-2 tabular-nums ${slip > 0 ? 'text-red-600 font-medium' : ''}`}>{slip > 0 ? `+${slip}d` : '—'}</td>
                  <td className="px-3 py-2"><PriorityDot priority={t.priority} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <TaskDrawer taskId={openId} onClose={() => setOpenId(null)} />
    </>
  );
}
