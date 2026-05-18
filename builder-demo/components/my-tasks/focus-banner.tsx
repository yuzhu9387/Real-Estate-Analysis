'use client';
import { useDemoStore } from '@/lib/store';

export function FocusBanner() {
  const currentUserId = useDemoStore((s) => s.currentUserId);
  const tasks = useDemoStore((s) => Object.values(s.tasks));
  const mine = tasks.filter(t => t.ownerId === currentUserId);
  const active = mine.filter(t => t.status !== 'Done' && t.status !== 'Approved').length;
  const revision = mine.filter(t => t.status === 'Needs Revision').length;
  const reviewing = tasks.filter(t => t.reviewerId === currentUserId && t.status === 'Submitted for Review').length;
  return (
    <div className="rounded-lg border border-border bg-card p-4 flex items-center gap-4">
      <Chip label="Active" value={active} />
      <Chip label="Needs revision (urgent)" value={revision} tone={revision > 0 ? 'warn' : 'default'} />
      <Chip label="To review" value={reviewing} />
    </div>
  );
}

function Chip({ label, value, tone = 'default' }: { label: string; value: number; tone?: 'default' | 'warn' }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className={`text-xl font-semibold ${tone === 'warn' ? 'text-amber-600' : ''}`}>{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
