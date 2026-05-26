import { cn } from '@/lib/utils';

export function KpiCard({ label, value, tone = 'default' }: {
  label: string; value: number | string;
  tone?: 'default' | 'warn' | 'danger' | 'success';
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn(
        'text-2xl font-semibold mt-1',
        tone === 'warn'    && 'text-amber-600',
        tone === 'danger'  && 'text-red-600',
        tone === 'success' && 'text-emerald-600',
      )}>{value}</div>
    </div>
  );
}
