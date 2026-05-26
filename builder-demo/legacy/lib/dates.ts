import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns';

export const PROJECT_DAY_ONE = '2026-03-06';
export const TODAY_DAY = 70;

const dayOneDate = parseISO(PROJECT_DAY_ONE);

export function today(): string {
  return dayToDate(TODAY_DAY);
}

export function dayToDate(day: number): string {
  // Day 1 = PROJECT_DAY_ONE, Day 2 = +1 calendar day, etc.
  return format(addDays(dayOneDate, day - 1), 'yyyy-MM-dd');
}

export function dateToDay(iso: string): number {
  return differenceInCalendarDays(parseISO(iso), dayOneDate) + 1;
}

export function dayDelta(targetDay: number): number {
  return targetDay - TODAY_DAY;
}

export function formatDateShort(iso: string): string {
  return format(parseISO(iso), 'MMM d');
}

export function formatDateLong(iso: string): string {
  return format(parseISO(iso), 'MMM d, yyyy');
}
