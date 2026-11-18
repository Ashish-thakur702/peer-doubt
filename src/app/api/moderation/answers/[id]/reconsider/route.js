import mongoose from 'mongoose';
import { z } from 'zod';
import connectDB from '@/lib/db';
import Answer from '@/models/Answer';
import Doubt from '@/models/Doubt';
import ModerationLog from '@/models/ModerationLog';
import { requirePermission } from '@/lib/session';
import { notifyUsers } from '@/lib/notifications';
import { validObjectId } from '@/lib/moderation';
import { getModerationAnswerFilter, getModerationDoubtFilter } from '@/lib/auth/scope.mjs';

const schema = z.object({ note: z.string().trim().min(3).max(1000) });

export async function PATCH(req, { params }) {
    const { session, user, error, status } = await requirePermission('canReconsiderRejected');
    if (error) return Response.json({ msg: error }, { status });
    const { id } = await params;
    if (!validObjectId(id)) return Response.json({ msg: 'Answer not found' }, { status: 404 });
    let body;
    try { body = await req.json(); } catch { return Response.json({ msg: 'Request body must be valid JSON' }, { status: 400 }); }
    const parsed = schema.safeParse(body);
    if (!parsed.success) return Response.json({ msg: parsed.error.issues[0].message }, { status: 400 });
    let transaction;
    try {
        await connectDB();
        transaction = await mongoose.startSession();
        let result;
        await transaction.withTransaction(async () => {
            const answerFilter = await getModerationAnswerFilter(user, { Doubt }, id);
            const answer = await Answer.findOne({ ...answerFilter, status: 'REJECTED' }).session(transaction).lean();
            if (!answer) throw Object.assign(new Error('Only rejected answers can be reconsidered'), { status: 409 });
            const doubt = await Doubt.findOneAndUpdate(
                { _id: answer.doubt, ...getModerationDoubtFilter(user), status: { $in: ['CLAIMED', 'ANSWERED'] } },
                { $set: { status: 'ANSWERED' } }, { new: true, session: transaction }
            );
            if (!doubt) throw Object.assign(new Error('The related doubt is no longer available for review'), { status: 409 });
            const updated = await Answer.findOneAndUpdate(
                { _id: id, doubt: answer.doubt, status: 'REJECTED' },
                { $set: { status: 'REVISION_REQUESTED' }, $push: { moderationHistory: { moderator: session.user.id, action: 'RECONSIDERED', reason: parsed.data.note } } },
                { new: true, session: transaction }
            );
            if (!updated) throw Object.assign(new Error('Answer changed during review'), { status: 409 });
            await ModerationLog.create([{
                entityType: 'answer', entityId: answer._id, action: 'RECONSIDERED', moderator: session.user.id,
                reason: parsed.data.note, relatedEntity: answer.doubt, relatedEntityType: 'doubt',
                idempotencyKey: `answer:${id}:reconsider:${updated.updatedAt.getTime()}`,
            }], { session: transaction });
            result = { helper: answer.helper, doubt: answer.doubt };
        });
        try {
            await notifyUsers([result.helper], {
                type: 'REVISION_REQUESTED', doubt: result.doubt, answer: id,
                message: `A faculty member reopened your rejected answer for revision: ${parsed.data.note}`,
                href: `/doubts/${result.doubt}#answer-${id}`, dedupeKey: `answer:${id}:reconsider:${Date.now()}`,
            });
        } catch (notifyError) { console.error('RECONSIDER_NOTIFICATION_FAILED', { name: notifyError?.name || 'Error' }); }
        return Response.json({ ok: true, status: 'REVISION_REQUESTED' });
    } catch (err) {
        return Response.json({ msg: err.status ? err.message : 'Could not reconsider this answer' }, { status: err.status || 500 });
    } finally { if (transaction) await transaction.endSession(); }
}
