import type { PermitKey } from './types';

export interface PermitMeta {
  key: PermitKey;
  label: string;
  hex: string;
  cssVar: string;   // e.g. 'var(--permit-planning)'
}

export const PERMITS: Record<PermitKey, PermitMeta> = {
  demo:            { key: 'demo',            label: 'Demo Permit',         hex: '#E76F51', cssVar: 'var(--permit-demo)' },
  tree:            { key: 'tree',            label: 'Tree Permit',         hex: '#2A9D8F', cssVar: 'var(--permit-tree)' },
  planning:        { key: 'planning',        label: 'Planning Review',     hex: '#4F46E5', cssVar: 'var(--permit-planning)' },
  'public-hearing':{ key: 'public-hearing',  label: 'Public Hearing',      hex: '#9333EA', cssVar: 'var(--permit-public-hearing)' },
  building:        { key: 'building',        label: 'Building Permit',     hex: '#2563EB', cssVar: 'var(--permit-building)' },
  utility:         { key: 'utility',         label: 'Utility',             hex: '#D97706', cssVar: 'var(--permit-utility)' },
  grading:         { key: 'grading',         label: 'Grading Permit',      hex: '#92400E', cssVar: 'var(--permit-grading)' },
  encroach:        { key: 'encroach',        label: 'Encroachment Permit', hex: '#0891B2', cssVar: 'var(--permit-encroach)' },
  design:          { key: 'design',          label: 'Design + Sales',      hex: '#DB2777', cssVar: 'var(--permit-design)' },
  approval:        { key: 'approval',        label: 'Permit Approval',     hex: '#059669', cssVar: 'var(--permit-approval)' },
  post:            { key: 'post',            label: 'Post Permit',         hex: '#475569', cssVar: 'var(--permit-post)' },
  issuance:        { key: 'issuance',        label: 'Permit Issuance',     hex: '#CA8A04', cssVar: 'var(--permit-issuance)' },
};

export const PHASE_ORDER: PermitKey[] = [
  'demo', 'tree', 'planning', 'public-hearing', 'building',
  'utility', 'grading', 'encroach', 'design', 'approval', 'post', 'issuance',
];

export function getPermit(key: PermitKey): PermitMeta {
  return PERMITS[key];
}

const PHASE_NAME_MAP: Record<string, PermitKey> = {
  'Demo Permit': 'demo',
  'Tree Permit': 'tree',
  'Planning Review': 'planning',
  'Public Hearing': 'public-hearing',
  'Building Permit': 'building',
  'Utility': 'utility',
  'Grading Permit': 'grading',
  'Encroachment Permit': 'encroach',
  'Design + Sales': 'design',
  'Permit Approval': 'approval',
  'Post Permit': 'post',
  'Permit Issuance': 'issuance',
};

export function permitFromPhaseName(name: string): PermitKey {
  const k = PHASE_NAME_MAP[name];
  if (!k) throw new Error(`Unknown phase name: ${name}`);
  return k;
}
