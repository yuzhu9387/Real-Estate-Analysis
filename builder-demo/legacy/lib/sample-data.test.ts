import { describe, it, expect } from 'vitest';
import { PROJECT, USERS, TASKS, JENNY_ID } from './sample-data';

describe('sample-data', () => {
  it('project is 9 Greenwood Pl', () => {
    expect(PROJECT.address).toContain('9 Greenwood Pl');
    expect(PROJECT.permitType).toBe('SFH – With Planning Review');
    expect(PROJECT.baselineStart).toBe('2026-03-06');
    expect(PROJECT.baselineEnd).toBe('2026-09-01');
    expect(PROJECT.health).toBe('At Risk');
  });

  it('has 8 users including Jenny', () => {
    expect(USERS).toHaveLength(8);
    expect(USERS.find(u => u.id === JENNY_ID)?.name).toBe('Jenny Wang');
  });

  it('has 29 tasks (28 template + 1 unplanned)', () => {
    expect(TASKS).toHaveLength(29);
    expect(TASKS.filter(t => t.source === 'unplanned')).toHaveLength(1);
  });

  it('Demo Corrections (task #3) is Needs Revision and owned by Jenny', () => {
    const t = TASKS.find(t => t.title === 'Demo Corrections / Resubmission')!;
    expect(t.status).toBe('Needs Revision');
    expect(t.ownerId).toBe(JENNY_ID);
    expect(t.reviewComment).toContain('asbestos');
  });

  it('Planning Corrections (task #8) is Delayed', () => {
    const t = TASKS.find(t => t.title === 'Planning Corrections / Resubmission')!;
    expect(t.status).toBe('Delayed');
    expect(t.plannedDueDay).toBe(65);
    expect(t.forecastDueDay).toBe(75);
  });

  it('tasks before today with end ≤ 50 are Done', () => {
    const tree = TASKS.find(t => t.title === 'Tree Removal Permit')!;
    expect(tree.status).toBe('Done');
    const planning1 = TASKS.find(t => t.title === 'Planning 1st Review')!;
    expect(planning1.status).toBe('Done');
  });

  it('tasks starting > Day 70 are Not Started or Blocked', () => {
    const issuance = TASKS.find(t => t.title === 'Final Permit Issuance')!;
    expect(['Not Started', 'Blocked']).toContain(issuance.status);
  });

  it('every task has an owner', () => {
    for (const t of TASKS) expect(t.ownerId).toBeTruthy();
  });
});
