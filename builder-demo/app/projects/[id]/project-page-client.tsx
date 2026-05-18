'use client';
import { AppShell } from '@/components/layout/app-shell';
import { ProjectSummary } from '@/components/project/project-summary';
import { OverviewTab } from '@/components/project/overview-tab';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
          <TabsContent value="timeline" className="mt-4">Timeline — coming in Task 17.</TabsContent>
          <TabsContent value="tasks" className="mt-4">Tasks — coming in Task 20.</TabsContent>
          <TabsContent value="activity" className="mt-4">Activity — coming in Task 21.</TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
