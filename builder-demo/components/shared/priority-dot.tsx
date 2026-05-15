import type { Priority } from '@/lib/types';

const COLORS: Record<Priority, string> = {
  Low: '#94A3B8',
  Medium: '#3B82F6',
  High: '#F59E0B',
  Critical: '#EF4444',
};

export function PriorityDot({ priority }: { priority: Priority }) {
  return (
    <span
      title={`Priority: ${priority}`}
      className="inline-block size-2 rounded-full"
      style={{ backgroundColor: COLORS[priority] }}
    />
  );
}
