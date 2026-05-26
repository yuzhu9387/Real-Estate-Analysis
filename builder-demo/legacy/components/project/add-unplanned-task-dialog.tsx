'use client';
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDemoStore } from '@/lib/store';
import { USERS, PROJECT } from '@/lib/sample-data';
import { PHASE_ORDER, PERMITS } from '@/lib/permits';
import { TODAY_DAY } from '@/lib/dates';
import type { PermitKey, UserId, Task } from '@/lib/types';
import { Plus } from 'lucide-react';

export function AddUnplannedTaskDialog() {
  const addUnplanned = useDemoStore((s) => s.addUnplanned);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [phase, setPhase] = useState<PermitKey>('planning');
  const [owner, setOwner] = useState<UserId>(USERS[0].id);
  const [days, setDays] = useState(3);

  function submit() {
    if (!title.trim()) return;
    const task: Task = {
      id: `task-unplanned-${Date.now()}`,
      projectId: PROJECT.id,
      title: title.trim(),
      phase,
      department: 'Permit',
      ownerId: owner,
      reviewerId: USERS[0].id,
      status: 'In Progress',
      priority: 'High',
      source: 'unplanned',
      plannedStartDay: TODAY_DAY,
      plannedDueDay: TODAY_DAY + days,
      forecastStartDay: TODAY_DAY,
      forecastDueDay: TODAY_DAY + days,
      actualStartDay: TODAY_DAY,
      actualEndDay: null,
      dependencyIds: [],
      isCriticalPath: false,
    };
    addUnplanned(task);
    setOpen(false);
    setTitle('');
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><Plus className="size-3.5 mr-1" />Add unplanned task</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add unplanned task</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Title</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs to happen?" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Phase</label>
              <Select value={phase} onValueChange={(v) => setPhase(v as PermitKey)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PHASE_ORDER.map(k => <SelectItem key={k} value={k}>{PERMITS[k].label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Owner</label>
              <Select value={owner} onValueChange={(v) => setOwner(v as UserId)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{USERS.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Duration (days)</label>
            <Input type="number" min={1} value={days} onChange={(e) => setDays(parseInt(e.target.value || '1'))} />
          </div>
          <div className="rounded-md bg-muted/50 p-3 text-xs">
            <strong>Impact preview:</strong> Will start at Day {TODAY_DAY} and end at Day {TODAY_DAY + days}. No downstream tasks shifted (no dependency selected).
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!title.trim()}>Add task</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
