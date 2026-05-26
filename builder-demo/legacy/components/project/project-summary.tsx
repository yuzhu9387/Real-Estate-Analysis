import { PROJECT, USERS } from '@/lib/sample-data';
import { Avatar } from '@/components/shared/avatar';
import { PermitChip } from '@/components/shared/permit-chip';
import { formatDateLong } from '@/lib/dates';
import { Home, Calendar, DollarSign } from 'lucide-react';
import { differenceInCalendarDays, parseISO } from 'date-fns';

export function ProjectSummary() {
  const owner = USERS.find(u => u.id === PROJECT.ownerId)!;
  const slip = differenceInCalendarDays(parseISO(PROJECT.forecastEnd), parseISO(PROJECT.baselineEnd));
  return (
    <div className="rounded-lg border border-border bg-card p-5 flex gap-5">
      <div className="size-32 rounded-md bg-muted flex items-center justify-center text-muted-foreground shrink-0">
        <Home className="size-10" />
      </div>
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold tracking-tight">{PROJECT.name}</h2>
          <PermitChip permit={PROJECT.currentPhase} />
          <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800">{PROJECT.health}</span>
        </div>
        <div className="text-sm text-muted-foreground">{PROJECT.address} · {PROJECT.permitType}</div>
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-2">
          <span className="inline-flex items-center gap-1.5"><Calendar className="size-3.5" /> Purchased {formatDateLong(PROJECT.purchaseDate)}</span>
          <span className="inline-flex items-center gap-1.5"><DollarSign className="size-3.5" /> ${PROJECT.purchaseCost.toLocaleString()}</span>
          <span>Baseline end: {formatDateLong(PROJECT.baselineEnd)}</span>
          <span className="text-red-600 font-medium">Forecast end: {formatDateLong(PROJECT.forecastEnd)} (+{slip}d)</span>
        </div>
        <div className="flex items-center gap-2 text-xs pt-1">
          <span className="text-muted-foreground">Project owner</span>
          <Avatar user={owner} /><span className="font-medium">{owner.name}</span>
        </div>
      </div>
    </div>
  );
}
