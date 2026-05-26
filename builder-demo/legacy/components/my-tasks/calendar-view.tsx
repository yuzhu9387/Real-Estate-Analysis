'use client';
import { useDemoStore } from '@/lib/store';
import { TODAY_DAY, dayToDate } from '@/lib/dates';
import { getPermit } from '@/lib/permits';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth } from 'date-fns';

export function CalendarView() {
  const currentUserId = useDemoStore((s) => s.currentUserId);
  const tasks = Object.values(useDemoStore((s) => s.tasks)).filter(t => t.ownerId === currentUserId);
  const today = parseISO(dayToDate(TODAY_DAY));
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-sm font-medium mb-3">{format(today, 'MMMM yyyy')}</div>
      <div className="grid grid-cols-7 gap-1 text-xs">
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => <div key={d} className="text-muted-foreground text-center py-1">{d}</div>)}
        {days.map(day => {
          const due = tasks.filter(t => isSameDay(parseISO(dayToDate(t.plannedDueDay)), day));
          const isToday = isSameDay(day, today);
          return (
            <div key={day.toISOString()} className={`min-h-16 border border-border rounded p-1 ${!isSameMonth(day, today) ? 'opacity-40' : ''} ${isToday ? 'bg-accent/50' : ''}`}>
              <div className="text-[10px] text-muted-foreground">{format(day, 'd')}</div>
              <div className="flex flex-wrap gap-0.5 mt-1">
                {due.map(t => (
                  <span key={t.id} title={t.title} className="size-1.5 rounded-full" style={{ backgroundColor: getPermit(t.phase).hex }} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
