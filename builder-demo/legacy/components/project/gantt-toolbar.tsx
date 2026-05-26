'use client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PHASE_ORDER, PERMITS } from '@/lib/permits';
import type { PermitKey, TaskStatus, UserId } from '@/lib/types';
import { USERS } from '@/lib/sample-data';

const STATUSES: (TaskStatus | 'all')[] = ['all','Not Started','In Progress','Submitted for Review','Needs Revision','Delayed','Blocked','Done'];

export function GanttToolbar({
  zoom, setZoom,
  filterPhase, setFilterPhase,
  filterStatus, setFilterStatus,
  filterOwner, setFilterOwner,
  showDependencies, setShowDependencies,
}: {
  zoom: 'week' | 'month' | 'quarter';
  setZoom: (z: 'week' | 'month' | 'quarter') => void;
  filterPhase: PermitKey | 'all'; setFilterPhase: (p: PermitKey | 'all') => void;
  filterStatus: TaskStatus | 'all'; setFilterStatus: (s: TaskStatus | 'all') => void;
  filterOwner: UserId | 'all'; setFilterOwner: (o: UserId | 'all') => void;
  showDependencies: boolean; setShowDependencies: (b: boolean) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 mb-2">
      <div className="flex border border-border rounded-md overflow-hidden">
        {(['week','month','quarter'] as const).map(z => (
          <button key={z}
            onClick={() => setZoom(z)}
            className={`px-3 py-1 text-xs ${zoom === z ? 'bg-accent font-medium' : 'hover:bg-accent/50'}`}>
            {z[0].toUpperCase() + z.slice(1)}
          </button>
        ))}
      </div>
      <Select value={filterPhase} onValueChange={(v) => setFilterPhase(v as PermitKey | 'all')}>
        <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="Phase" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All phases</SelectItem>
          {PHASE_ORDER.map(k => <SelectItem key={k} value={k}>{PERMITS[k].label}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as TaskStatus | 'all')}>
        <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
        <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s === 'all' ? 'All statuses' : s}</SelectItem>)}</SelectContent>
      </Select>
      <Select value={filterOwner} onValueChange={(v) => setFilterOwner(v as UserId | 'all')}>
        <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="Owner" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All owners</SelectItem>
          {USERS.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
        </SelectContent>
      </Select>
      <Button variant={showDependencies ? 'default' : 'outline'} size="sm" onClick={() => setShowDependencies(!showDependencies)}>
        {showDependencies ? 'Hide' : 'Show'} dependencies
      </Button>
    </div>
  );
}
