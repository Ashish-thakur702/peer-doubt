import { requireAuth } from '@/lib/session';

export async function GET() {
    const { session, error, status } = await requireAuth();
    if (error) return Response.json({ msg: error }, { status });
    return Response.json({ role: session.user.role, roles: session.user.roles, status: session.user.status });
}
