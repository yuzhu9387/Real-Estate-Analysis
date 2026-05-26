import type { TaskStatus } from '@/lib/types';
import { CheckCircle2, Clock, AlertTriangle, Lock, CircleDot, Loader2, Check, XCircle, Hourglass } from 'lucide-react';

const STATUS_STYLE: Record<TaskStatus, { color: string; bg: string; Icon: typeof CheckCircle2 }> = {
  'Not Started':           { color: '#64748B', bg: '#F1F5F9', Icon: CircleDot },
  'Ready':                 { color: '#0F766E', bg: '#CCFBF1', Icon: CircleDot },
  'In Progress':           { color: '#1D4ED8', bg: '#DBEAFE', Icon: Loader2 },
  'Submitted for Review':  { color: '#7E22CE', bg: '#F3E8FF', Icon: Hourglass },
  'Needs Revision':        { color: '#B45309', bg: '#FEF3C7', Icon: AlertTriangle },
  'Approved':              { color: '#047857', bg: '#D1FAE5', Icon: Check },
  'Done':                  { color: '#047857', bg: '#D1FAE5', Icon: CheckCircle2 },
  'Delayed':               { color: '#B91C1C', bg: '#FEE2E2', Icon: Clock },
  'Blocked':               { color: '#475569', bg: '#E2E8F0', Icon: Lock },
  'Cancelled':             { color: '#94A3B8', bg: '#F8FAFC', Icon: XCircle },
};

export function StatusBadge({ status }: { status: TaskStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium"
      style={{ color: s.color, backgroundColor: s.bg }}
    >
      <s.Icon className="size-3" />
      {status}
    </span>
  );
}
