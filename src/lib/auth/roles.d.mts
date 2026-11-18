export type Role = 'student' | 'helper' | 'cr' | 'faculty' | 'admin';
export type Permission =
    | 'canModerate'
    | 'canVerifyAnswer'
    | 'canReviewReports'
    | 'canMarkDuplicate'
    | 'canArchiveKnowledge'
    | 'canReconsiderRejected'
    | 'canManageUsers'
    | 'canHelp'
    | 'canAskQuestion';

export const ROLES: Readonly<Record<'STUDENT' | 'HELPER' | 'CR' | 'FACULTY' | 'ADMIN', Role>>;
export const ROLE_VALUES: readonly Role[];
export const ROLE_HIERARCHY: readonly Role[];
export const PERMISSIONS: Readonly<Record<Permission, readonly Role[]>>;
export function normalizeRoles(userOrRoles: unknown): Role[];
export function getPrimaryRole(userOrRoles: unknown): Role;
export function hasRole(userOrRoles: unknown, role: Role): boolean;
export function hasPermission(userOrRoles: unknown, permission: Permission): boolean;
export function roleLabel(role: Role): string;
