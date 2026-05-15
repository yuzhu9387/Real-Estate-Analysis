import { describe, it, expect, beforeEach } from 'vitest';
import { useDemoStore } from './store';
import { JENNY_ID, SARAH_ID } from './sample-data';

describe('store', () => {
  beforeEach(() => {
    useDemoStore.getState().resetDemo();
  });

  it('initial currentUserId is Jenny', () => {
    expect(useDemoStore.getState().currentUserId).toBe(JENNY_ID);
  });

  it('setCurrentUser switches role', () => {
    useDemoStore.getState().setCurrentUser(SARAH_ID);
    expect(useDemoStore.getState().currentUserId).toBe(SARAH_ID);
  });

  it('setStatus mutates a task', () => {
    const tasks = useDemoStore.getState().tasks;
    const someId = Object.keys(tasks)[0];
    useDemoStore.getState().setStatus(someId, 'Done');
    expect(useDemoStore.getState().tasks[someId].status).toBe('Done');
  });

  it('logs an ActivityEvent on status change', () => {
    const before = useDemoStore.getState().activity.length;
    const someId = Object.keys(useDemoStore.getState().tasks)[0];
    useDemoStore.getState().setStatus(someId, 'In Progress');
    expect(useDemoStore.getState().activity.length).toBe(before + 1);
  });
});
