import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Task, TaskId, UserId, ActivityEvent, TaskStatus } from './types';
import { PROJECT, TASKS, USERS, JENNY_ID } from './sample-data';
import { today } from './dates';

interface DemoState {
  currentUserId: UserId;
  tasks: Record<TaskId, Task>;
  activity: ActivityEvent[];
  setCurrentUser: (id: UserId) => void;
  setStatus: (id: TaskId, status: TaskStatus, comment?: string) => void;
  submitForReview: (id: TaskId) => void;
  approve: (id: TaskId) => void;
  requestRevision: (id: TaskId, comment: string) => void;
  markDone: (id: TaskId) => void;
  reopen: (id: TaskId, reason: string) => void;
  addUnplanned: (task: Task) => void;
  resetDemo: () => void;
}

function initialTasksMap(): Record<TaskId, Task> {
  return Object.fromEntries(TASKS.map(t => [t.id, { ...t }]));
}

function pushActivity(state: DemoState, action: string, taskId?: TaskId, comment?: string): DemoState {
  return {
    ...state,
    activity: [
      ...state.activity,
      {
        id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: today(),
        actorId: state.currentUserId,
        action,
        taskId,
        comment,
      },
    ],
  };
}

export const useDemoStore = create<DemoState>()(
  persist(
    (set, get) => ({
      currentUserId: JENNY_ID,
      tasks: initialTasksMap(),
      activity: [],

      setCurrentUser: (id) => set({ currentUserId: id }),

      setStatus: (id, status, comment) =>
        set((s) => pushActivity(
          { ...s, tasks: { ...s.tasks, [id]: { ...s.tasks[id], status, ...(comment && { reviewComment: comment }) } } },
          `changed status of "${s.tasks[id].title}" to ${status}`,
          id,
          comment,
        )),

      submitForReview: (id) =>
        set((s) => pushActivity(
          { ...s, tasks: { ...s.tasks, [id]: { ...s.tasks[id], status: 'Submitted for Review' } } },
          `submitted "${s.tasks[id].title}" for review`,
          id,
        )),

      approve: (id) =>
        set((s) => pushActivity(
          { ...s, tasks: { ...s.tasks, [id]: { ...s.tasks[id], status: 'Approved' } } },
          `approved "${s.tasks[id].title}"`,
          id,
        )),

      requestRevision: (id, comment) =>
        set((s) => pushActivity(
          { ...s, tasks: { ...s.tasks, [id]: { ...s.tasks[id], status: 'Needs Revision', reviewComment: comment } } },
          `requested revision on "${s.tasks[id].title}"`,
          id,
          comment,
        )),

      markDone: (id) =>
        set((s) => pushActivity(
          {
            ...s,
            tasks: { ...s.tasks, [id]: { ...s.tasks[id], status: 'Done', actualEndDay: 70 } },
          },
          `marked "${s.tasks[id].title}" done`,
          id,
        )),

      reopen: (id, reason) =>
        set((s) => pushActivity(
          { ...s, tasks: { ...s.tasks, [id]: { ...s.tasks[id], status: 'In Progress' } } },
          `reopened "${s.tasks[id].title}": ${reason}`,
          id,
          reason,
        )),

      addUnplanned: (task) =>
        set((s) => pushActivity(
          { ...s, tasks: { ...s.tasks, [task.id]: task } },
          `added unplanned task "${task.title}"`,
          task.id,
        )),

      resetDemo: () =>
        set({
          currentUserId: JENNY_ID,
          tasks: initialTasksMap(),
          activity: [],
        }),
    }),
    {
      name: 'builder-demo-state',
      skipHydration: typeof window === 'undefined',
    },
  ),
);

// Static re-exports for convenience
export { PROJECT, USERS };
