import test from 'node:test';
import assert from 'node:assert/strict';
import { authorizeCurrentUser, canRemoveActiveAdmin } from '../src/lib/auth/policy.mjs';
import { getModerationCourses, hasModerationCourseAccess } from '../src/lib/auth/scope-policy.mjs';
import { publicRegistrationFields } from '../src/lib/auth/public-registration.mjs';

const sessionUser = { id: '507f1f77bcf86cd799439011', roles: ['admin'] };

test('public registration always provisions a student and drops client role data', () => {
    const user = publicRegistrationFields({ name: 'Test', email: 'test@example.test', passwordHash: 'hashed', role: 'admin', roles: ['admin'] });
    assert.equal(user.role, 'student');
    assert.deepEqual(user.roles, ['student']);
    assert.equal(user.status, 'active');
});

test('moderation guard returns 401, 403, and 200 across the five roles', () => {
    const expected = { student: 403, helper: 403, cr: 200, faculty: 200, admin: 200 };
    for (const [role, status] of Object.entries(expected)) {
        const result = authorizeCurrentUser({ sessionUser, currentUser: { role, roles: [role] }, permission: 'canModerate' });
        assert.equal(result.status, status, `${role} moderation status`);
    }
    assert.equal(authorizeCurrentUser({ sessionUser: null, currentUser: null, permission: 'canModerate' }).status, 401);
});

test('guard policy status matrix covers every role permission', () => {
    const expected = {
        canModerate: { student: 403, helper: 403, cr: 200, faculty: 200, admin: 200 },
        canVerifyAnswer: { student: 403, helper: 403, cr: 200, faculty: 200, admin: 200 },
        canReviewReports: { student: 403, helper: 403, cr: 200, faculty: 200, admin: 200 },
        canMarkDuplicate: { student: 403, helper: 403, cr: 200, faculty: 200, admin: 200 },
        canArchiveKnowledge: { student: 403, helper: 403, cr: 403, faculty: 200, admin: 200 },
        canReconsiderRejected: { student: 403, helper: 403, cr: 403, faculty: 200, admin: 200 },
        canManageUsers: { student: 403, helper: 403, cr: 403, faculty: 403, admin: 200 },
        canHelp: { student: 403, helper: 200, cr: 403, faculty: 403, admin: 403 },
        canAskQuestion: { student: 200, helper: 200, cr: 200, faculty: 200, admin: 200 },
    };
    for (const [permission, roleStatuses] of Object.entries(expected)) {
        assert.equal(authorizeCurrentUser({ sessionUser, currentUser: null, permission }).status, 401, `${permission} unauthenticated`);
        for (const [role, status] of Object.entries(roleStatuses)) {
            const result = authorizeCurrentUser({ sessionUser, currentUser: { role, roles: [role] }, permission });
            assert.equal(result.status, status, `${permission} for ${role}`);
        }
    }
});

test('a database role downgrade overrides an old administrator JWT', () => {
    const result = authorizeCurrentUser({
        sessionUser,
        currentUser: { _id: sessionUser.id, role: 'student', roles: ['student'], status: 'active' },
        permission: 'canManageUsers',
    });
    assert.equal(result.status, 403);
});

test('suspended database accounts are denied even when their session is current', () => {
    const result = authorizeCurrentUser({
        sessionUser,
        currentUser: { role: 'admin', roles: ['admin'], status: 'suspended' },
        permission: 'canManageUsers',
    });
    assert.equal(result.status, 403);
    assert.match(result.error, /suspended/i);
});

test('CR scope only includes assigned courses in the server query policy', () => {
    const cr = { role: 'cr', roles: ['cr'], assignedCourses: ['OS'] };
    const courses = { OS: [], DAA: [] };
    assert.deepEqual(getModerationCourses(cr, courses), ['OS']);
    assert.equal(hasModerationCourseAccess(cr, 'OS', courses), true);
    assert.equal(hasModerationCourseAccess(cr, 'DAA', courses), false);
});

test('the final active administrator cannot be removed', () => {
    assert.equal(canRemoveActiveAdmin({ remainingActiveAdmins: 0 }), false);
    assert.equal(canRemoveActiveAdmin({ remainingActiveAdmins: 1 }), true);
});
