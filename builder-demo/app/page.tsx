'use client';
import { AppShell } from '@/components/layout/app-shell';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { PermitStageStepper } from '@/components/dashboard/permit-stage-stepper';
import { ProjectStatusTable } from '@/components/dashboard/project-status-table';
import { TeamWorkload } from '@/components/dashboard/team-workload';
import { UpcomingDeadlines } from '@/components/dashboard/upcoming-deadlines';
import { useDemoStore } from '@/lib/store';
import { computeKpis } from '@/lib/dashboard-kpis';
import { PROJECT } from '@/lib/sample-data';
import type { PermitKey } from '@/lib/types';

export default function DashboardPage() {
  const tasks = useDemoStore((s) => Object.values(s.tasks));
  const kpi = computeKpis(tasks);
  const completedPhases = new Set<PermitKey>(['tree']);
  return (
    <AppShell title="Dashboard">
      <div className="space-y-4 max-w-screen-2xl">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard label="Active projects" value={kpi.activeProjects} />
          <KpiCard label="At risk" value={kpi.atRisk} tone="warn" />
          <KpiCard label="Overdue" value={kpi.overdue} tone="danger" />
          <KpiCard label="Needs revision" value={kpi.needsRevision} tone="warn" />
          <KpiCard label="Critical-path overdue" value={kpi.criticalOverdue} tone="danger" />
          <KpiCard label="Due ≤ 7 days" value={kpi.upcoming7d} />
        </div>

        <ProjectStatusTable />
        <PermitStageStepper current={PROJECT.currentPhase} completed={completedPhases} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <TeamWorkload />
          <UpcomingDeadlines />
        </div>
      </div>
    </AppShell>
  );
}
