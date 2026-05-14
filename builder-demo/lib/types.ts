export type UserId = string;
export type TaskId = string;
export type ProjectId = string;

export type PermitKey =
  | 'demo' | 'tree' | 'planning' | 'public-hearing' | 'building'
  | 'utility' | 'grading' | 'encroach' | 'design' | 'approval'
  | 'post' | 'issuance';

export type DepartmentKey =
  | 'Utility' | 'Permit' | 'Planning' | 'Design' | 'Civil'
  | 'Interior Design' | 'Landscape' | 'Visualization' | 'Sales';

export type TaskStatus =
  | 'Not Started' | 'Ready' | 'In Progress' | 'Submitted for Review'
  | 'Needs Revision' | 'Approved' | 'Done' | 'Delayed' | 'Blocked' | 'Cancelled';

export type Priority = 'Low' | 'Medium' | 'High' | 'Critical';

export interface User {
  id: UserId;
  name: string;
  role: string;
  departments: DepartmentKey[];
  initials: string;
  avatarColor: string;
}

export interface Project {
  id: ProjectId;
  name: string;
  address: string;
  permitType: string;
  purchaseDate: string;        // ISO
  purchaseCost: number;
  ownerId: UserId;
  baselineStart: string;       // ISO; Day 1
  baselineEnd: string;         // ISO
  forecastEnd: string;         // ISO
  health: 'On Track' | 'At Risk' | 'Delayed';
  currentPhase: PermitKey;
}

export interface Task {
  id: TaskId;
  projectId: ProjectId;
  title: string;
  phase: PermitKey;
  department: DepartmentKey;
  ownerId: UserId;
  reviewerId: UserId | null;
  status: TaskStatus;
  priority: Priority;
  source: 'template' | 'unplanned';
  reviewComment?: string;
  // Day offsets from project Day 1
  plannedStartDay: number;
  plannedDueDay: number;
  forecastStartDay: number;
  forecastDueDay: number;
  actualStartDay: number | null;
  actualEndDay: number | null;
  dependencyIds: TaskId[];     // predecessors (Finish-to-Start)
  isCriticalPath: boolean;
}

export interface ActivityEvent {
  id: string;
  timestamp: string;           // ISO
  actorId: UserId;
  action: string;              // sentence
  taskId?: TaskId;
  comment?: string;
}
