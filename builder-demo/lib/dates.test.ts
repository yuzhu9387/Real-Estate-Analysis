import { describe, it, expect } from 'vitest';
import { PROJECT_DAY_ONE, TODAY_DAY, dayToDate, dateToDay, dayDelta, today } from './dates';

describe('dates', () => {
  it('PROJECT_DAY_ONE is 2026-03-06', () => {
    expect(PROJECT_DAY_ONE).toBe('2026-03-06');
  });

  it('TODAY_DAY is 70', () => {
    expect(TODAY_DAY).toBe(70);
  });

  it('today() returns 2026-05-14', () => {
    expect(today()).toBe('2026-05-14');
  });

  it('dayToDate(1) = 2026-03-06', () => {
    expect(dayToDate(1)).toBe('2026-03-06');
  });

  it('dayToDate(70) = 2026-05-14', () => {
    expect(dayToDate(70)).toBe('2026-05-14');
  });

  it('dayToDate(180) = 2026-09-01', () => {
    expect(dayToDate(180)).toBe('2026-09-01');
  });

  it('dateToDay round trips', () => {
    expect(dateToDay('2026-05-14')).toBe(70);
    expect(dateToDay('2026-03-06')).toBe(1);
  });

  it('dayDelta returns negative for past days', () => {
    expect(dayDelta(65)).toBe(-5);
    expect(dayDelta(70)).toBe(0);
    expect(dayDelta(75)).toBe(5);
  });
});
