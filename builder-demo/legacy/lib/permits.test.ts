import { describe, it, expect } from 'vitest';
import { PERMITS, getPermit, permitFromPhaseName } from './permits';

describe('permits', () => {
  it('has 12 permit definitions', () => {
    expect(Object.keys(PERMITS)).toHaveLength(12);
  });

  it('every permit has a label and hex color', () => {
    for (const p of Object.values(PERMITS)) {
      expect(p.label).toMatch(/^[A-Z]/);
      expect(p.hex).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });

  it('getPermit returns the right entry', () => {
    expect(getPermit('planning').label).toBe('Planning Review');
  });

  it('permitFromPhaseName maps AED template phase strings to keys', () => {
    expect(permitFromPhaseName('Planning Review')).toBe('planning');
    expect(permitFromPhaseName('Demo Permit')).toBe('demo');
    expect(permitFromPhaseName('Public Hearing')).toBe('public-hearing');
    expect(permitFromPhaseName('Post Permit')).toBe('post');
    expect(permitFromPhaseName('Design + Sales')).toBe('design');
  });
});
