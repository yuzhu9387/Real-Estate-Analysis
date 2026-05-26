import type { DepartmentKey, PermitKey } from './types';

export interface TemplateTask {
  startDay: number;
  endDay: number;
  duration: number;     // endDay - startDay
  phase: PermitKey;
  department: DepartmentKey;
  title: string;
}

export const SFH_WITH_PLANNING_REVIEW = {
  name: 'SFH – With Planning Review',
  type: 'SFH – w/ Planning Review',
  bizLine: 'AL Homes',
  totalDays: 180,
  totalMonths: '6 months',
};

// Source: AED_Project_Timeline_Report.html → DATA["AL Homes"][1]
// 28 tasks, 12 phases. Day offsets are from project Day 1.
export const TEMPLATE_TASKS: TemplateTask[] = [
  // Demo Permit (5)
  { startDay:  7, endDay:  15, duration:  8, phase: 'demo',    department: 'Utility',         title: 'Utility Cutoff + Asbestos + J Number' },
  { startDay: 15, endDay:  45, duration: 30, phase: 'demo',    department: 'Permit',          title: 'Demo Permit Review' },
  { startDay: 45, endDay:  75, duration: 30, phase: 'demo',    department: 'Permit',          title: 'Demo Corrections / Resubmission' },
  { startDay: 75, endDay:  95, duration: 20, phase: 'demo',    department: 'Permit',          title: 'Demo Approval' },
  { startDay: 95, endDay: 110, duration: 15, phase: 'demo',    department: 'Permit',          title: 'Demo Permit Issuance' },
  // Tree Permit (1)
  { startDay: 15, endDay:  55, duration: 40, phase: 'tree',    department: 'Design',          title: 'Tree Removal Permit' },
  // Planning Review (3)
  { startDay: 20, endDay:  50, duration: 30, phase: 'planning',department: 'Planning',        title: 'Planning 1st Review' },
  { startDay: 50, endDay:  65, duration: 15, phase: 'planning',department: 'Planning',        title: 'Planning Corrections / Resubmission' },
  { startDay: 65, endDay:  80, duration: 15, phase: 'planning',department: 'Planning',        title: 'Planning Approval' },
  // Public Hearing (1)
  { startDay: 80, endDay:  95, duration: 15, phase: 'public-hearing', department: 'Planning', title: 'Planning Commission / Historic Review' },
  // Building Permit (2)
  { startDay: 100, endDay: 130, duration: 30, phase: 'building', department: 'Design',        title: '1st Submission → Comments' },
  { startDay: 130, endDay: 145, duration: 15, phase: 'building', department: 'Design',        title: 'Resubmission' },
  // Utility (3)
  { startDay: 100, endDay: 105, duration:  5, phase: 'utility',  department: 'Utility',       title: 'PG&E Will Serve' },
  { startDay: 100, endDay: 107, duration:  7, phase: 'utility',  department: 'Utility',       title: 'Water Will Serve' },
  { startDay: 100, endDay: 160, duration: 60, phase: 'utility',  department: 'Utility',       title: 'Sewer Will Serve' },
  // Grading Permit (1)
  { startDay: 100, endDay: 165, duration: 65, phase: 'grading',  department: 'Civil',         title: 'Grading Permit' },
  // Encroachment Permit (1)
  { startDay: 100, endDay: 160, duration: 60, phase: 'encroach', department: 'Civil',         title: 'Encroachment Permit' },
  // Design + Sales (4)
  { startDay: 145, endDay: 166, duration: 21, phase: 'design',   department: 'Interior Design', title: 'Interior Design Package' },
  { startDay: 145, endDay: 159, duration: 14, phase: 'design',   department: 'Landscape',       title: 'Landscape Design Package' },
  { startDay: 145, endDay: 159, duration: 14, phase: 'design',   department: 'Visualization',   title: 'Rendering / Exterior Package' },
  { startDay: 145, endDay: 166, duration: 21, phase: 'design',   department: 'Sales',           title: 'Sales Package' },
  // Permit Approval (1)
  { startDay: 145, endDay: 160, duration: 15, phase: 'approval', department: 'Design',         title: 'Final Approval' },
  // Post Permit (5)
  { startDay: 160, endDay: 205, duration:  45, phase: 'post',     department: 'Design',        title: 'Solar Permit' },
  { startDay: 160, endDay: 220, duration:  60, phase: 'post',     department: 'Design',        title: 'Fire Sprinkler Permit' },
  { startDay: 160, endDay: 340, duration: 180, phase: 'post',     department: 'Utility',       title: 'Electrical New Service' },
  { startDay: 160, endDay: 280, duration: 120, phase: 'post',     department: 'Utility',       title: 'Water New Service' },
  { startDay: 160, endDay: 220, duration:  60, phase: 'post',     department: 'Utility',       title: 'Sewer New Service' },
  // Permit Issuance (1)
  { startDay: 160, endDay: 180, duration:  20, phase: 'issuance', department: 'Design',        title: 'Final Permit Issuance' },
];
