import { dayToDate, formatDateShort } from '@/lib/dates';

export function ThreeLayerDates({
  plannedStart, plannedDue, forecastStart, forecastDue, actualStart, actualEnd,
}: {
  plannedStart: number; plannedDue: number;
  forecastStart: number; forecastDue: number;
  actualStart: number | null; actualEnd: number | null;
}) {
  return (
    <div className="grid grid-cols-3 gap-3 text-xs">
      <div>
        <div className="text-muted-foreground uppercase tracking-wide">Baseline</div>
        <div className="font-medium">{formatDateShort(dayToDate(plannedStart))} → {formatDateShort(dayToDate(plannedDue))}</div>
      </div>
      <div>
        <div className="text-muted-foreground uppercase tracking-wide">Forecast</div>
        <div className="font-medium">{formatDateShort(dayToDate(forecastStart))} → {formatDateShort(dayToDate(forecastDue))}</div>
      </div>
      <div>
        <div className="text-muted-foreground uppercase tracking-wide">Actual</div>
        <div className="font-medium">
          {actualStart ? formatDateShort(dayToDate(actualStart)) : '—'} → {actualEnd ? formatDateShort(dayToDate(actualEnd)) : '—'}
        </div>
      </div>
    </div>
  );
}
