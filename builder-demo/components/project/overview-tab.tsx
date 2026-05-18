'use client';
import { useDemoStore } from '@/lib/store';
import { TODAY_DAY } from '@/lib/dates';
import { computeKpis } from '@/lib/dashboard-kpis';
import { KpiCard } from '@/components/dashboard/kpi-card';

export function OverviewTab() {
  const tasks = Object.values(useDemoStore((s) => s.tasks));
  const kpi = computeKpis(tasks);
  const done = tasks.filter(t => t.status === 'Done').length;
  const pct = Math.round((done / tasks.length) * 100);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Day elapsed" value={`${TODAY_DAY} / 180`} />
        <KpiCard label="% complete" value={`${pct}%`} />
        <KpiCard label="Delayed" value={tasks.filter(t => t.status === 'Delayed').length} tone="danger" />
        <KpiCard label="Needs revision" value={kpi.needsRevision} tone="warn" />
      </div>
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="text-sm font-medium mb-2">Critical path</div>
        <div className="text-xs text-muted-foreground">
          Planning Corrections is 5 days overdue and sits on the critical path. Its slip propagates through Public Hearing, Building Permit, Final Approval, and Permit Issuance — pushing forecast end by +10 days.
        </div>
      </div>
    </div>
  );
}
