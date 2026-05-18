'use client';
import { useState } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { FocusBanner } from '@/components/my-tasks/focus-banner';
import { TaskCard } from '@/components/my-tasks/task-card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDemoStore } from '@/lib/store';
import { TaskDrawer } from '@/components/project/task-drawer';
import type { TaskId } from '@/lib/types';
import { AnimatePresence } from 'framer-motion';

export default function MyTasksPage() {
  const currentUserId = useDemoStore((s) => s.currentUserId);
  const tasks = useDemoStore((s) => Object.values(s.tasks));
  const [openId, setOpenId] = useState<TaskId | null>(null);
  const mine = tasks
    .filter(t => t.ownerId === currentUserId && t.status !== 'Done' && t.status !== 'Approved')
    .sort((a, b) => a.plannedDueDay - b.plannedDueDay);

  return (
    <AppShell title="My Tasks">
      <div className="space-y-4 max-w-screen-xl">
        <FocusBanner />
        <Tabs defaultValue="tasks">
          <TabsList>
            <TabsTrigger value="tasks">My Tasks</TabsTrigger>
            <TabsTrigger value="reviews">My Reviews</TabsTrigger>
            <TabsTrigger value="calendar">Calendar</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>
          <TabsContent value="tasks" className="mt-4">
            {mine.length === 0
              ? <div className="rounded-lg border border-border bg-card p-12 text-center text-muted-foreground">All clear ✓ — no active tasks for you.</div>
              : <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  <AnimatePresence>
                    {mine.map(t => <TaskCard key={t.id} task={t} onClick={() => setOpenId(t.id)} />)}
                  </AnimatePresence>
                </div>}
          </TabsContent>
          <TabsContent value="reviews">Reviews — coming in Task 23.</TabsContent>
          <TabsContent value="calendar">Calendar — coming in Task 23.</TabsContent>
          <TabsContent value="history">History — coming in Task 23.</TabsContent>
        </Tabs>
      </div>
      <TaskDrawer taskId={openId} onClose={() => setOpenId(null)} />
    </AppShell>
  );
}
