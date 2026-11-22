import { withApiErrors } from '@/lib/api-errors';
import { requireAuth } from '@/lib/session';

async function handleGET() {
    const { session, error, status } = await requireAuth();
    if (error) return Response.json({ msg: error }, { status });
    return Response.json({ role: session.user.role, roles: session.user.roles, status: session.user.status });
}

export const GET = withApiErrors(handleGET, { route: '/api/auth/me', method: 'GET' });
