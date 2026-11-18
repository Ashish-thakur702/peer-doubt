import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/db';
import User from '@/models/User';
import { validObjectId } from '@/lib/moderation';
import { authorizeCurrentUser } from '@/lib/auth/policy.mjs';

export async function getCurrentUser() {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!userId || !validObjectId(userId)) return { session: null, user: null, error: 'Not logged in', status: 401 };

    try {
        await connectDB();
        const user = await User.findById(userId)
            .select('name email role roles status isSuspended isHelper courses availability helperProfile assignedCourses department')
            .lean();
        const decision = authorizeCurrentUser({ sessionUser: session.user, currentUser: user });
        if (decision.status !== 200) return { session: null, user: null, error: decision.error, status: decision.status };
        const roles = decision.user.roles;
        const currentUser = {
            ...decision.user,
            roles,
            isHelper: Boolean(user.isHelper || user.helperProfile?.isHelper || user.helperProfile?.isWilling),
            courses: user.courses?.length ? user.courses : (user.helperProfile?.courses || []),
            availability: Boolean(user.availability || user.helperProfile?.availability || user.helperProfile?.isWilling),
        };
        session.user = {
            ...session.user,
            id: user._id.toString(),
            name: user.name,
            email: user.email,
            role: currentUser.role,
            roles,
            status: 'active',
        };
        return { session, user: currentUser };
    } catch (error) {
        console.error('AUTH_USER_LOOKUP_FAILED', { name: error?.name || 'Error', code: error?.code || error?.cause?.code || 'UNKNOWN' });
        return { session: null, user: null, error: 'Authentication service is temporarily unavailable', status: 503 };
    }
}

export async function requireAuth() {
    return getCurrentUser();
}

export async function requireRole(...allowed) {
    const result = await getCurrentUser();
    if (result.error) return result;
    const decision = authorizeCurrentUser({ sessionUser: result.session.user, currentUser: result.user, allowedRoles: allowed });
    if (decision.status !== 200) return { session: null, user: null, error: decision.error, status: decision.status };
    return result;
}

export async function requirePermission(permission) {
    const result = await getCurrentUser();
    if (result.error) return result;
    const decision = authorizeCurrentUser({ sessionUser: result.session.user, currentUser: result.user, permission });
    if (decision.status !== 200) return { session: null, user: null, error: decision.error, status: decision.status };
    return result;
}
