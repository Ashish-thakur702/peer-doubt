import { withApiErrors } from '@/lib/api-errors';
import connectDB from '@/lib/db';
import Notification from '@/models/Notification';
import { parsePagination } from '@/lib/moderation';
import { requireRole } from '@/lib/session';

async function handleGET(req) {
    const { session, error, status } = await requireRole();
    if (error) return Response.json({ msg: error }, { status });
    await connectDB();
    const { page, limit, skip } = parsePagination(new URL(req.url).searchParams);
    const filter = { recipient: session.user.id };
    const [items, total, unread] = await Promise.all([
        Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        Notification.countDocuments(filter),
        Notification.countDocuments({ ...filter, readAt: null }),
    ]);
    return Response.json({ items, unread, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}

async function handlePATCH() {
    const { session, error, status } = await requireRole();
    if (error) return Response.json({ msg: error }, { status });
    await connectDB();
    await Notification.updateMany({ recipient: session.user.id, readAt: null }, { $set: { readAt: new Date() } });
    return Response.json({ ok: true });
}

export const GET = withApiErrors(handleGET, { route: '/api/notifications', method: 'GET' });
export const PATCH = withApiErrors(handlePATCH, { route: '/api/notifications', method: 'PATCH' });
