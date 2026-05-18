'use client';
import { useState } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { ProjectSummary } from '@/components/project/project-summary';
import { OverviewTab } from '@/components/project/overview-tab';
import { GanttChart } from '@/components/project/gantt-chart';
import { GanttToolbar } from '@/components/project/gantt-toolbar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { PermitKey, TaskId, TaskStatus, UserId } from '@/lib/types';
import { TaskDrawer } from '@/components/project/task-drawer';
import { TaskTable } from '@/components/project/task-table';
import { ActivityFeed } from '@/components/project/activity-feed';
import { AddUnplannedTaskDialog } from '@/components/project/add-unplanned-task-dialog';

function TimelineSection() {
  const [zoom, setZoom] = useState<'week'|'month'|'quarter'>('month');
  const [filterPhase, setFilterPhase] = useState<PermitKey | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<TaskStatus | 'all'>('all');
  const [filterOwner, setFilterOwner] = useState<UserId | 'all'>('all');
  const [showDependencies, setShowDependencies] = useState(true);
  const [openTaskId, setOpenTaskId] = useState<TaskId | null>(null);
  return (
    <>
      <GanttToolbar
        zoom={zoom} setZoom={setZoom}
        filterPhase={filterPhase} setFilterPhase={setFilterPhase}
        filterStatus={filterStatus} setFilterStatus={setFilterStatus}
        filterOwner={filterOwner} setFilterOwner={setFilterOwner}
        showDependencies={showDependencies} setShowDependencies={setShowDependencies}
      />
      <GanttChart
        zoom={zoom}
        filterPhase={filterPhase}
        filterStatus={filterStatus}
        filterOwner={filterOwner}
        showDependencies={showDependencies}
        onTaskClick={setOpenTaskId}
      />
      <TaskDrawer taskId={openTaskId} onClose={() => setOpenTaskId(null)} />
    </>
  );
}

export function ProjectPageClient() {
  return (
    <AppShell title="9 Greenwood Pl">
      <div className="space-y-4 max-w-screen-2xl">
        <ProjectSummary />
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="mt-4"><OverviewTab /></TabsContent>
          <TabsContent value="timeline" className="mt-4"><TimelineSection /></TabsContent>
          <TabsContent value="tasks" className="mt-4">
            <div className="space-y-3">
              <div className="flex justify-end"><AddUnplannedTaskDialog /></div>
              <TaskTable />
            </div>
          </TabsContent>
          <TabsContent value="activity" className="mt-4"><ActivityFeed /></TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
