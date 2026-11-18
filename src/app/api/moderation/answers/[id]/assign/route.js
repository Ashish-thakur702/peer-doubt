import connectDB from '@/lib/db';
import Answer from '@/models/Answer';
import { requirePermission } from '@/lib/session';
import { validObjectId } from '@/lib/moderation';
import Doubt from '@/models/Doubt';
import { getModerationAnswerFilter } from '@/lib/auth/scope.mjs';

const PENDING = ['PENDING', 'SUBMITTED', 'PENDING_REVIEW', 'ACCEPTED'];

export async function PUT(_req, { params }) {
    const { session, user, error, status } = await requirePermission('canModerate');
    if (error) return Response.json({ msg: error }, { status });
    const { id } = await params;
    if (!validObjectId(id)) return Response.json({ msg: 'Answer not found' }, { status: 404 });
    await connectDB();
    const scopedAnswer = await getModerationAnswerFilter(user, { Doubt }, id);
    const answer = await Answer.findOneAndUpdate(
        { ...scopedAnswer, status: { $in: PENDING }, $or: [{ reviewAssignedTo: null }, { reviewAssignedTo: session.user.id }] },
        { $set: { reviewAssignedTo: session.user.id, reviewAssignedAt: new Date() } }, { new: true }
    ).select('reviewAssignedTo reviewAssignedAt').lean();
    if (!answer) return Response.json({ msg: 'This answer is closed or assigned to another moderator' }, { status: 409 });
    return Response.json({ ok: true, assignedTo: answer.reviewAssignedTo, assignedAt: answer.reviewAssignedAt });
}

export async function DELETE(_req, { params }) {
    const { session, user, error, status } = await requirePermission('canModerate');
    if (error) return Response.json({ msg: error }, { status });
    const { id } = await params;
    if (!validObjectId(id)) return Response.json({ msg: 'Answer not found' }, { status: 404 });
    await connectDB();
    const scopedAnswer = await getModerationAnswerFilter(user, { Doubt }, id);
    const answer = await Answer.findOneAndUpdate(
        { ...scopedAnswer, reviewAssignedTo: session.user.id, status: { $in: ['PENDING', 'SUBMITTED', 'PENDING_REVIEW', 'ACCEPTED'] } },
        { $unset: { reviewAssignedTo: 1, reviewAssignedAt: 1 } }, { new: true }
    ).select('_id').lean();
    return Response.json({ ok: true, released: Boolean(answer) });
}
