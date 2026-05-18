'use client';
import { useState } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { FocusBanner } from '@/components/my-tasks/focus-banner';
import { TaskCard } from '@/components/my-tasks/task-card';
import { ReviewCard } from '@/components/my-tasks/review-card';
import { CalendarView } from '@/components/my-tasks/calendar-view';
import { HistoryList } from '@/components/my-tasks/history-list';
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
  const myReviews = tasks.filter(t => t.reviewerId === currentUserId && t.status === 'Submitted for Review');

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
          <TabsContent value="reviews" className="mt-4">
            {myReviews.length === 0
              ? <div className="rounded-lg border border-border bg-card p-12 text-center text-muted-foreground">Inbox zero ✓</div>
              : <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{myReviews.map(t => <ReviewCard key={t.id} task={t} />)}</div>}
          </TabsContent>
          <TabsContent value="calendar" className="mt-4"><CalendarView /></TabsContent>
          <TabsContent value="history" className="mt-4"><HistoryList /></TabsContent>
        </Tabs>
      </div>
      <TaskDrawer taskId={openId} onClose={() => setOpenId(null)} />
    </AppShell>
  );
}
