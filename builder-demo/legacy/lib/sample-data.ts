import type { Project, Task, User, UserId, DepartmentKey, TaskStatus, ActivityEvent } from './types';
import { TEMPLATE_TASKS } from './aed-template';
import { TODAY_DAY } from './dates';

export const SARAH_ID: UserId = 'user-sarah';
export const MIKE_ID: UserId = 'user-mike';
export const JENNY_ID: UserId = 'user-jenny';
export const DAVID_ID: UserId = 'user-david';
export const LISA_ID: UserId = 'user-lisa';
export const TOM_ID: UserId = 'user-tom';
export const EMMA_ID: UserId = 'user-emma';
export const ALEX_ID: UserId = 'user-alex';

export const USERS: User[] = [
  { id: SARAH_ID, name: 'Sarah Chen',      role: 'Project Manager',        departments: [],                                                             initials: 'SC', avatarColor: '#4F46E5' },
  { id: MIKE_ID,  name: 'Mike Rodriguez',  role: 'Design Team Lead',       departments: ['Design'],                                                     initials: 'MR', avatarColor: '#2563EB' },
  { id: JENNY_ID, name: 'Jenny Wang',      role: 'Permit Specialist',      departments: ['Permit'],                                                     initials: 'JW', avatarColor: '#E76F51' },
  { id: DAVID_ID, name: 'David Park',      role: 'Planning Specialist',    departments: ['Planning'],                                                   initials: 'DP', avatarColor: '#9333EA' },
  { id: LISA_ID,  name: 'Lisa Thompson',   role: 'Civil Engineer',         departments: ['Civil'],                                                      initials: 'LT', avatarColor: '#0891B2' },
  { id: TOM_ID,   name: 'Tom Williams',    role: 'Utility Coordinator',    departments: ['Utility'],                                                    initials: 'TW', avatarColor: '#D97706' },
  { id: EMMA_ID,  name: 'Emma Liu',        role: 'Designer',               departments: ['Interior Design', 'Landscape', 'Visualization', 'Sales'],     initials: 'EL', avatarColor: '#DB2777' },
  { id: ALEX_ID,  name: 'Alex Kumar',      role: 'Executive',              departments: [],                                                             initials: 'AK', avatarColor: '#475569' },
];

const DEPT_OWNER: Record<DepartmentKey, UserId> = {
  Design: MIKE_ID,
  Permit: JENNY_ID,
  Planning: DAVID_ID,
  Civil: LISA_ID,
  Utility: TOM_ID,
  'Interior Design': EMMA_ID,
  Landscape: EMMA_ID,
  Visualization: EMMA_ID,
  Sales: EMMA_ID,
};

function reviewerFor(department: DepartmentKey): UserId | null {
  switch (department) {
    case 'Permit':   return SARAH_ID;
    case 'Planning': return MIKE_ID;
    case 'Design':   return SARAH_ID;
    default:         return SARAH_ID;
  }
}

export const PROJECT: Project = {
  id: 'prj-9-greenwood-pl',
  name: '9 Greenwood Pl',
  address: '9 Greenwood Pl, Newton, MA',
  permitType: 'SFH – With Planning Review',
  purchaseDate: '2025-09-15',
  purchaseCost: 850000,
  ownerId: SARAH_ID,
  baselineStart: '2026-03-06',
  baselineEnd: '2026-09-01',
  forecastEnd: '2026-09-11',
  health: 'At Risk',
  currentPhase: 'planning',
};

function computeStatus(plannedEnd: number, plannedStart: number): TaskStatus {
  if (plannedEnd <= TODAY_DAY) return 'Done';
  if (plannedStart > TODAY_DAY) return 'Not Started';
  return 'In Progress';
}

interface StatusOverride {
  index: number;
  status: TaskStatus;
  forecastDueDay?: number;
  reviewComment?: string;
  priority?: Task['priority'];
}

const OVERRIDES: StatusOverride[] = [
  { index: 2,  status: 'Needs Revision', forecastDueDay: 78,
    reviewComment: 'Missing asbestos clearance attachment. Please resubmit with cert.', priority: 'High' },
  { index: 3,  status: 'Blocked' },
  { index: 4,  status: 'Blocked' },
  { index: 7,  status: 'Delayed', forecastDueDay: 75, priority: 'Critical' },
  { index: 8,  status: 'Blocked' },
  { index: 9,  status: 'Blocked' },
];

function buildDependencies(tasks: Task[]): void {
  for (let i = 1; i <= 4; i++) tasks[i].dependencyIds = [tasks[i - 1].id];
  tasks[7].dependencyIds = [tasks[6].id];
  tasks[8].dependencyIds = [tasks[7].id];
  tasks[9].dependencyIds = [tasks[8].id];
  tasks[10].dependencyIds = [tasks[9].id];
  tasks[11].dependencyIds = [tasks[10].id];
  for (let i = 17; i <= 20; i++) tasks[i].dependencyIds = [tasks[11].id];
  tasks[21].dependencyIds = [tasks[11].id, ...tasks.slice(17, 21).map(t => t.id)];
  tasks[27].dependencyIds = [tasks[21].id];
}

const CRITICAL_PATH_INDEXES = new Set([6, 7, 8, 9, 10, 11, 21, 27]);

export const TASKS: Task[] = (() => {
  const tasks: Task[] = TEMPLATE_TASKS.map((t, i) => {
    const ownerId = DEPT_OWNER[t.department];
    const reviewerId = reviewerFor(t.department);
    let status: TaskStatus = computeStatus(t.endDay, t.startDay);
    if (status === 'In Progress' && t.startDay > TODAY_DAY) status = 'Not Started';
    return {
      id: `task-${String(i + 1).padStart(2, '0')}`,
      projectId: PROJECT.id,
      title: t.title,
      phase: t.phase,
      department: t.department,
      ownerId,
      reviewerId,
      status,
      priority: 'Medium' as const,
      source: 'template' as const,
      plannedStartDay: t.startDay,
      plannedDueDay: t.endDay,
      forecastStartDay: t.startDay,
      forecastDueDay: t.endDay,
      actualStartDay: status === 'Done' ? t.startDay : null,
      actualEndDay: status === 'Done' ? t.endDay : null,
      dependencyIds: [],
      isCriticalPath: CRITICAL_PATH_INDEXES.has(i),
    };
  });

  buildDependencies(tasks);

  for (const o of OVERRIDES) {
    const t = tasks[o.index];
    t.status = o.status;
    if (o.forecastDueDay !== undefined) t.forecastDueDay = o.forecastDueDay;
    if (o.reviewComment !== undefined) t.reviewComment = o.reviewComment;
    if (o.priority !== undefined) t.priority = o.priority;
    if (o.status === 'Needs Revision' || o.status === 'Delayed') {
      t.actualStartDay = t.plannedStartDay;
      t.actualEndDay = null;
    }
  }

  tasks.push({
    id: 'task-29',
    projectId: PROJECT.id,
    title: 'Respond to neighbor zoning objection re: setback',
    phase: 'planning',
    department: 'Planning',
    ownerId: DAVID_ID,
    reviewerId: SARAH_ID,
    status: 'In Progress',
    priority: 'High',
    source: 'unplanned',
    plannedStartDay: 65,
    plannedDueDay: 70,
    forecastStartDay: 65,
    forecastDueDay: 73,
    actualStartDay: 65,
    actualEndDay: null,
    dependencyIds: [],
    isCriticalPath: false,
  });

  return tasks;
})();

// Synthetic review-handoff entries (not part of template). They populate
// the My Reviews tab for Jenny.
export function buildReviewHandoffs(): Task[] {
  return [
    {
      id: 'task-rh-1',
      projectId: PROJECT.id,
      title: 'Verify setback math for Planning Corrections',
      phase: 'planning',
      department: 'Permit',
      ownerId: DAVID_ID,
      reviewerId: JENNY_ID,
      status: 'Submitted for Review',
      priority: 'High',
      source: 'unplanned',
      plannedStartDay: 65,
      plannedDueDay: 72,
      forecastStartDay: 65,
      forecastDueDay: 72,
      actualStartDay: 65,
      actualEndDay: null,
      dependencyIds: [],
      isCriticalPath: false,
    },
    {
      id: 'task-rh-2',
      projectId: PROJECT.id,
      title: 'Tree Permit closeout — verify final docs',
      phase: 'tree',
      department: 'Permit',
      ownerId: MIKE_ID,
      reviewerId: JENNY_ID,
      status: 'Submitted for Review',
      priority: 'Medium',
      source: 'unplanned',
      plannedStartDay: 55,
      plannedDueDay: 60,
      forecastStartDay: 55,
      forecastDueDay: 60,
      actualStartDay: 55,
      actualEndDay: null,
      dependencyIds: [],
      isCriticalPath: false,
    },
  ];
}

export const SAMPLE_ACTIVITY: ActivityEvent[] = [
  { id: 'a1',  timestamp: '2026-05-09', actorId: SARAH_ID, action: 'rejected "Demo Permit Review" — missing asbestos clearance attachment', taskId: 'task-02', comment: 'Please attach asbestos cert and resubmit.' },
  { id: 'a2',  timestamp: '2026-05-09', actorId: JENNY_ID, action: 'began revising "Demo Corrections / Resubmission"', taskId: 'task-03' },
  { id: 'a3',  timestamp: '2026-05-08', actorId: DAVID_ID, action: 'flagged "Planning Corrections / Resubmission" at risk of slipping past Day 65', taskId: 'task-08' },
  { id: 'a4',  timestamp: '2026-05-10', actorId: SARAH_ID, action: 'added unplanned task "Respond to neighbor zoning objection re: setback"', taskId: 'task-29' },
  { id: 'a5',  timestamp: '2026-05-12', actorId: DAVID_ID, action: 'started "Respond to neighbor zoning objection re: setback"', taskId: 'task-29' },
  { id: 'a6',  timestamp: '2026-05-13', actorId: SARAH_ID, action: 'updated project forecast end from 2026-09-01 to 2026-09-11 (+10d)' },
  { id: 'a7',  timestamp: '2026-04-25', actorId: MIKE_ID,  action: 'closed "Tree Removal Permit"', taskId: 'task-06' },
  { id: 'a8',  timestamp: '2026-04-21', actorId: MIKE_ID,  action: 'approved "Planning 1st Review"', taskId: 'task-07' },
  { id: 'a9',  timestamp: '2026-04-18', actorId: DAVID_ID, action: 'submitted "Planning 1st Review" for review', taskId: 'task-07' },
  { id: 'a10', timestamp: '2026-04-15', actorId: JENNY_ID, action: 'closed "Utility Cutoff + Asbestos + J Number"', taskId: 'task-01' },
];
