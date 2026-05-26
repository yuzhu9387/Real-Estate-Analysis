import { describe, it, expect } from 'vitest';
import { computeCriticalPath } from './critical-path';
import { TASKS } from './sample-data';

describe('critical-path', () => {
  it('includes Planning Review → Public Hearing → Building → Approval → Issuance', () => {
    const cp = computeCriticalPath(TASKS);
    const titles = TASKS.filter(t => cp.has(t.id)).map(t => t.title);
    expect(titles).toContain('Planning 1st Review');
    expect(titles).toContain('Planning Corrections / Resubmission');
    expect(titles).toContain('Planning Approval');
    expect(titles).toContain('Planning Commission / Historic Review');
    expect(titles).toContain('1st Submission → Comments');
    expect(titles).toContain('Resubmission');
    expect(titles).toContain('Final Approval');
    expect(titles).toContain('Final Permit Issuance');
  });
});
