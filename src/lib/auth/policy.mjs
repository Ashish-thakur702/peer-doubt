import { getPrimaryRole, hasPermission, normalizeRoles } from './roles.mjs';

export function authorizeCurrentUser({ sessionUser, currentUser, allowedRoles = [], permission }) {
    if (!sessionUser?.id || !currentUser) return { status: 401, error: 'Not logged in' };
    if (currentUser.isSuspended || currentUser.status === 'suspended')
        return { status: 403, error: 'This account is suspended' };

    const roles = normalizeRoles(currentUser);
    if (allowedRoles.length && !roles.some((role) => allowedRoles.includes(role)))
        return { status: 403, error: 'Forbidden' };
    if (permission && !hasPermission(roles, permission))
        return { status: 403, error: 'Forbidden' };

    return {
        status: 200,
        user: { ...currentUser, roles, role: getPrimaryRole(roles), status: 'active' },
    };
}

export function canRemoveActiveAdmin({ remainingActiveAdmins }) {
    return remainingActiveAdmins > 0;
}
