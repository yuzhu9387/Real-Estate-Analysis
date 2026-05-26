'use client';
import { toast } from 'sonner';
import type { Task } from '@/lib/types';
import { useDemoStore } from '@/lib/store';

export function showCompletionToast(task: Task, previousStatus: Task['status']) {
  toast.success(`Marked "${task.title}" done`, {
    description: 'It moved to History.',
    action: {
      label: 'Undo',
      onClick: () => useDemoStore.getState().setStatus(task.id, previousStatus),
    },
    duration: 8000,
  });
}
