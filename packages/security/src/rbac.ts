import { OrgRole } from '@prisma/client';

export const Permission = {
  // Workspace management
  WORKSPACE_MANAGE: 'workspace:manage',
  WORKSPACE_VIEW: 'workspace:view',
  MEMBER_MANAGE: 'member:manage',

  // Lab & Incident operations
  LAB_VIEW: 'lab:view',
  INCIDENT_INJECT: 'incident:inject',
  INCIDENT_VIEW: 'incident:view',
  AGENT_DISPATCH: 'agent:dispatch',

  // Solution Arena & Adjudication
  EVALUATION_RUN: 'evaluation:run',
  EVALUATION_VIEW: 'evaluation:view',
  PATCH_APPROVE: 'patch:approve',
  CANARY_DEPLOY: 'canary:deploy',

  // Reference Library & Audit
  REFERENCE_VIEW: 'reference:view',
  REFERENCE_PUBLISH: 'reference:publish',
  AUDIT_VIEW: 'audit:view',
} as const;

export type Permission = (typeof Permission)[keyof typeof Permission];

export const ROLE_PERMISSIONS: Record<OrgRole, ReadonlySet<Permission>> = {
  [OrgRole.OWNER]: new Set(Object.values(Permission)),

  [OrgRole.ADMIN]: new Set([
    Permission.WORKSPACE_MANAGE,
    Permission.WORKSPACE_VIEW,
    Permission.MEMBER_MANAGE,
    Permission.LAB_VIEW,
    Permission.INCIDENT_INJECT,
    Permission.INCIDENT_VIEW,
    Permission.AGENT_DISPATCH,
    Permission.EVALUATION_RUN,
    Permission.EVALUATION_VIEW,
    Permission.PATCH_APPROVE,
    Permission.CANARY_DEPLOY,
    Permission.REFERENCE_VIEW,
    Permission.REFERENCE_PUBLISH,
    Permission.AUDIT_VIEW,
  ]),

  [OrgRole.ENGINEER]: new Set([
    Permission.WORKSPACE_VIEW,
    Permission.LAB_VIEW,
    Permission.INCIDENT_INJECT,
    Permission.INCIDENT_VIEW,
    Permission.AGENT_DISPATCH,
    Permission.EVALUATION_RUN,
    Permission.EVALUATION_VIEW,
    Permission.REFERENCE_VIEW,
  ]),

  [OrgRole.REVIEWER]: new Set([
    Permission.WORKSPACE_VIEW,
    Permission.LAB_VIEW,
    Permission.INCIDENT_VIEW,
    Permission.EVALUATION_VIEW,
    Permission.PATCH_APPROVE,
    Permission.CANARY_DEPLOY,
    Permission.REFERENCE_VIEW,
    Permission.REFERENCE_PUBLISH,
    Permission.AUDIT_VIEW,
  ]),

  [OrgRole.VIEWER]: new Set([
    Permission.WORKSPACE_VIEW,
    Permission.LAB_VIEW,
    Permission.INCIDENT_VIEW,
    Permission.EVALUATION_VIEW,
    Permission.REFERENCE_VIEW,
  ]),
};

export function hasPermission(role: OrgRole, permission: Permission): boolean {
  const allowed = ROLE_PERMISSIONS[role];
  return allowed ? allowed.has(permission) : false;
}
