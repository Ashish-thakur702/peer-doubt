export const ROLES = Object.freeze({
    STUDENT: 'student',
    HELPER: 'helper',
    CR: 'cr',
    FACULTY: 'faculty',
    ADMIN: 'admin',
});

export const ROLE_VALUES = Object.freeze(Object.values(ROLES));

export const ROLE_HIERARCHY = Object.freeze([
    ROLES.ADMIN,
    ROLES.FACULTY,
    ROLES.CR,
    ROLES.HELPER,
    ROLES.STUDENT,
]);

const PERMISSION_ROLES = Object.freeze({
    canModerate: [ROLES.ADMIN, ROLES.FACULTY, ROLES.CR],
    canVerifyAnswer: [ROLES.ADMIN, ROLES.FACULTY],
    canForwardAnswer: [ROLES.CR],
    canReviewReports: [ROLES.ADMIN, ROLES.FACULTY, ROLES.CR],
    canMarkDuplicate: [ROLES.ADMIN, ROLES.FACULTY, ROLES.CR],
    canArchiveKnowledge: [ROLES.ADMIN, ROLES.FACULTY],
    canReconsiderRejected: [ROLES.ADMIN, ROLES.FACULTY],
    canManageUsers: [ROLES.ADMIN],
    canHelp: [ROLES.HELPER],
    canAskQuestion: ROLE_VALUES,
});

export const PERMISSIONS = PERMISSION_ROLES;

export function normalizeRoles(userOrRoles) {
    const roles = Array.isArray(userOrRoles)
        ? userOrRoles
        : [...(Array.isArray(userOrRoles?.roles) ? userOrRoles.roles : []), userOrRoles?.role].filter(Boolean);
    const normalized = [...new Set(roles.filter((role) => ROLE_VALUES.includes(role)))];
    if (userOrRoles && !Array.isArray(userOrRoles) && (userOrRoles.isHelper || userOrRoles.helperProfile?.isHelper || userOrRoles.helperProfile?.isWilling)) {
        normalized.push(ROLES.HELPER);
        if (!normalized.includes(ROLES.STUDENT)) normalized.push(ROLES.STUDENT);
    }
    return normalized.length ? [...new Set(normalized)] : [ROLES.STUDENT];
}

export function getPrimaryRole(userOrRoles) {
    const roles = normalizeRoles(userOrRoles);
    return ROLE_HIERARCHY.find((role) => roles.includes(role)) || ROLES.STUDENT;
}

export function hasRole(userOrRoles, role) {
    return normalizeRoles(userOrRoles).includes(role);
}

export function hasPermission(userOrRoles, permission) {
    const allowedRoles = PERMISSION_ROLES[permission];
    return Boolean(allowedRoles && normalizeRoles(userOrRoles).some((role) => allowedRoles.includes(role)));
}

export function roleLabel(role) {
    return ({ cr: 'Course representative', faculty: 'Faculty', admin: 'Admin', helper: 'Helper', student: 'Student' })[role] || 'Student';
}
