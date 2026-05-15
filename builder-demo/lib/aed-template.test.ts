import { describe, it, expect } from 'vitest';
import { SFH_WITH_PLANNING_REVIEW, TEMPLATE_TASKS } from './aed-template';

describe('aed-template SFH–With Planning Review', () => {
  it('totalDays is 180', () => {
    expect(SFH_WITH_PLANNING_REVIEW.totalDays).toBe(180);
  });
  it('has 28 tasks', () => {
    expect(TEMPLATE_TASKS).toHaveLength(28);
  });
  it('every task has start, end, department, phase', () => {
    for (const t of TEMPLATE_TASKS) {
      expect(t.startDay).toBeGreaterThanOrEqual(0);
      expect(t.endDay).toBeGreaterThan(t.startDay);
      expect(t.department).toBeTruthy();
      expect(t.phase).toBeTruthy();
      expect(t.title).toBeTruthy();
    }
  });
  it('first task is Utility Cutoff + Asbestos + J Number, day 7→15', () => {
    const first = TEMPLATE_TASKS[0];
    expect(first.title).toBe('Utility Cutoff + Asbestos + J Number');
    expect(first.startDay).toBe(7);
    expect(first.endDay).toBe(15);
    expect(first.phase).toBe('demo');
  });
});
