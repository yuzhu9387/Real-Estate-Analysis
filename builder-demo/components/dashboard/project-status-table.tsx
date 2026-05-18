'use client';
import Link from 'next/link';
import { PROJECT, USERS } from '@/lib/sample-data';
import { PermitChip } from '@/components/shared/permit-chip';
import { Avatar } from '@/components/shared/avatar';
import { formatDateShort } from '@/lib/dates';
import { differenceInCalendarDays, parseISO } from 'date-fns';

export function ProjectStatusTable() {
  const owner = USERS.find(u => u.id === PROJECT.ownerId)!;
  const variance = differenceInCalendarDays(parseISO(PROJECT.forecastEnd), parseISO(PROJECT.baselineEnd));
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border text-sm font-medium">Projects</div>
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="text-left px-4 py-2 font-medium">Project</th>
            <th className="text-left px-4 py-2 font-medium">Phase</th>
            <th className="text-left px-4 py-2 font-medium">Forecast End</th>
            <th className="text-left px-4 py-2 font-medium">Variance</th>
            <th className="text-left px-4 py-2 font-medium">Owner</th>
            <th className="text-left px-4 py-2 font-medium">Health</th>
          </tr>
        </thead>
        <tbody>
          <tr className="hover:bg-accent/50">
            <td className="px-4 py-3">
              <Link href={`/projects/${PROJECT.id}`} className="font-medium hover:underline">
                {PROJECT.name}
              </Link>
              <div className="text-xs text-muted-foreground">{PROJECT.address}</div>
            </td>
            <td className="px-4 py-3"><PermitChip permit={PROJECT.currentPhase} /></td>
            <td className="px-4 py-3">{formatDateShort(PROJECT.forecastEnd)}</td>
            <td className="px-4 py-3 text-red-600 font-medium">+{variance}d</td>
            <td className="px-4 py-3"><div className="flex items-center gap-2"><Avatar user={owner} /> {owner.name}</div></td>
            <td className="px-4 py-3"><span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800">{PROJECT.health}</span></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
