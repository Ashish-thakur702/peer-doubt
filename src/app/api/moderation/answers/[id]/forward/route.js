import { withApiErrors } from '@/lib/api-errors';
import mongoose from 'mongoose';
import { z } from 'zod';
import connectDB from '@/lib/db';
import Answer from '@/models/Answer';
import Doubt from '@/models/Doubt';
import ModerationLog from '@/models/ModerationLog';
import { requirePermission } from '@/lib/session';
import { getModerationAnswerFilter } from '@/lib/auth/scope.mjs';
import { notifyUsers } from '@/lib/notifications';
import { validObjectId } from '@/lib/moderation';

const schema = z.discriminatedUnion('decision', [
    z.object({ decision: z.literal('FORWARD') }),
    z.object({
        decision: z.literal('REJECT'),
        category: z.enum(['INCORRECT', 'INCOMPLETE', 'OFF_TOPIC', 'SPAM_INAPPROPRIATE', 'OTHER']),
        note: z.string().trim().min(3).max(900),
    }),
]);
const PENDING = ['PENDING', 'SUBMITTED', 'PENDING_REVIEW', 'ACCEPTED'];
const CATEGORY_LABELS = {
    INCORRECT: 'Incorrect',
    INCOMPLETE: 'Incomplete',
    OFF_TOPIC: 'Off-topic',
    SPAM_INAPPROPRIATE: 'Spam or inappropriate content',
    OTHER: 'Other',
};

async function handlePATCH(req, { params }) {
    const { session, user, error, status } = await requirePermission('canForwardAnswer');
    if (error) return Response.json({ msg: error }, { status });
    const { id } = await params;
    if (!validObjectId(id)) return Response.json({ msg: 'Answer not found' }, { status: 404 });

    let body;
    try { body = await req.json(); } catch { return Response.json({ msg: 'Request body must be valid JSON' }, { status: 400 }); }
    const parsed = schema.safeParse(body);
    if (!parsed.success) return Response.json({ msg: parsed.error.issues[0].message }, { status: 400 });

    await connectDB();
    let transaction;
    let result;
    try {
        transaction = await mongoose.startSession();
        await transaction.withTransaction(async () => {
            const filter = await getModerationAnswerFilter(user, { Doubt }, id);
            const answer = await Answer.findOne({ ...filter, status: { $in: PENDING } })
                .session(transaction)
                .populate({ path: 'doubt', options: { session: transaction } });
            if (!answer?.doubt) throw Object.assign(new Error('Only pending answers in your assigned courses can be reviewed'), { status: 404 });
            if (answer.helper?._id?.toString() === session.user.id || answer.helper?.toString() === session.user.id)
                throw Object.assign(new Error('You cannot moderate your own answer'), { status: 403 });

            const action = parsed.data.decision === 'FORWARD' ? 'FORWARDED_TO_FACULTY' : 'REJECTED';
            const reason = parsed.data.decision === 'REJECT'
                ? `${CATEGORY_LABELS[parsed.data.category]}: ${parsed.data.note}`
                : '';
            const updated = await Answer.findOneAndUpdate(
                { _id: id, doubt: answer.doubt._id, status: answer.status },
                {
                    $set: parsed.data.decision === 'FORWARD'
                        ? { status: 'FACULTY_PENDING' }
                        : { status: 'REJECTED' },
                    ...(parsed.data.decision === 'FORWARD'
                        ? { $unset: { reviewAssignedTo: 1, reviewAssignedAt: 1 } }
                        : { $push: { moderationHistory: { moderator: session.user.id, action, reason, createdAt: new Date() } } }),
                    ...(parsed.data.decision === 'FORWARD'
                        ? { $push: { moderationHistory: { moderator: session.user.id, action, createdAt: new Date() } } }
                        : {}),
                },
                { new: true, session: transaction }
            );
            if (!updated) throw Object.assign(new Error('Answer changed during review. Refresh and try again.'), { status: 409 });

            const demoKey = answer.isDemoData ? `${answer.demoKey}:cr:${action.toLowerCase()}` : undefined;
            await ModerationLog.create([{
                entityType: 'answer',
                entityId: answer._id,
                action,
                moderator: session.user.id,
                reason,
                relatedEntity: answer.doubt._id,
                relatedEntityType: 'doubt',
                idempotencyKey: `answer:${id}:cr:${action.toLowerCase()}`,
                ...(demoKey ? { isDemoData: true, demoKey } : {}),
            }], { session: transaction });
            result = { helper: answer.helper?._id || answer.helper, doubt: answer.doubt._id, status: updated.status, demoKey };
        });

        if (parsed.data.decision === 'REJECT') {
            try {
                await notifyUsers([result.helper], {
                    type: 'ANSWER_REJECTED',
                    doubt: result.doubt,
                    answer: id,
                    message: `Your answer was rejected by the course representative. ${CATEGORY_LABELS[parsed.data.category]}: ${parsed.data.note}`,
                    href: `/doubts/${result.doubt}#answer-${id}`,
                    dedupeKey: `answer:${id}:cr:rejected`,
                    ...(result.demoKey ? { isDemoData: true, demoKey: `${result.demoKey}:notification` } : {}),
                });
            } catch (notifyError) { console.error('CR_REJECTION_NOTIFICATION_FAILED', { name: notifyError?.name || 'Error' }); }
        }
        return Response.json({ ok: true, status: result.status });
    } catch (err) {
        if (err.status) return Response.json({ msg: err.message }, { status: err.status });
        console.error('CR_ANSWER_REVIEW_FAILED', { name: err?.name || 'Error', code: err?.code || 'UNKNOWN' });
        return Response.json({ msg: 'Could not save this first-level review' }, { status: 500 });
    } finally {
        if (transaction) await transaction.endSession();
    }
}

export const PATCH = withApiErrors(handlePATCH, { route: '/api/moderation/answers/[id]/forward', method: 'PATCH' });
