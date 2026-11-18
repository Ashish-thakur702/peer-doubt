const LOGIN_ROLE_GROUPS = Object.freeze({
    student: ['student', 'helper'],
    academic: ['cr', 'faculty'],
    admin: ['admin'],
});

export function canSignInAs(user, loginAs) {
    if (!Object.prototype.hasOwnProperty.call(LOGIN_ROLE_GROUPS, loginAs)) return false;
    const allowedRoles = LOGIN_ROLE_GROUPS[loginAs];

    const roles = [
        ...(Array.isArray(user?.roles) ? user.roles : []),
        user?.role,
    ].filter(Boolean);

    return roles.some((role) => allowedRoles.includes(role));
}
