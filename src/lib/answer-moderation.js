import mongoose from 'mongoose';
import { z } from 'zod';
import connectDB from '@/lib/db';
import Answer from '@/models/Answer';
import Doubt from '@/models/Doubt';
import KnowledgeEntry from '@/models/KnowledgeEntry';
import User from '@/models/User';
import { recordModerationAction, validObjectId } from '@/lib/moderation';
import { requirePermission } from '@/lib/session';
import { notifyUsers } from '@/lib/notifications';
import { getModerationAnswerFilter } from '@/lib/auth/scope.mjs';

const REJECTION_CATEGORIES = {
    INCORRECT: 'Incorrect',
    INCOMPLETE: 'Incomplete',
    OFF_TOPIC: 'Off-topic',
    SPAM_INAPPROPRIATE: 'Spam or inappropriate content',
    OTHER: 'Other',
};
const rejectSchema = z.object({
    category: z.enum(Object.keys(REJECTION_CATEGORIES)),
    rating: z.number().int().min(1).max(5),
    feedback: z.string().trim().min(3).max(1000),
}).refine((value) => value.category !== 'OTHER' || value.feedback.length >= 3, {
    message: 'Add an explanation when selecting Other',
});
const reviewSchema = z.object({
    rating: z.number().int().min(1).max(5),
    feedback: z.string().trim().min(3).max(1000),
});

class ModerationRequestError extends Error {
    constructor(message, status) {
        super(message);
        this.status = status;
    }
}

export async function moderateAnswer(req, params, action) {
    const { session, user, error, status } = await requirePermission('canVerifyAnswer');
    if (error) return Response.json({ msg: error }, { status });

    const { id } = await params;
    if (!validObjectId(id)) return Response.json({ msg: 'Answer not found' }, { status: 404 });

    let body;
    try {
        body = await req.json();
    } catch {
        return Response.json({ msg: 'Request body must be valid JSON' }, { status: 400 });
    }
    const schema = action === 'REJECTED' ? rejectSchema : reviewSchema;
    const parsed = schema.safeParse(body);
    if (!parsed.success) return Response.json({ msg: parsed.error.issues[0].message }, { status: 400 });
    const reasonCategory = action === 'REJECTED' ? parsed.data.category : undefined;
    const reason = action === 'REJECTED'
        ? `${REJECTION_CATEGORIES[reasonCategory]}: ${parsed.data.feedback}`
        : parsed.data.feedback;
    const targetStatus = action === 'NEEDS_IMPROVEMENT'
        ? 'REVISION_REQUESTED'
        : action;

    let transaction;
    try {
        await connectDB();
        transaction = await mongoose.startSession();
        let result;
        await transaction.withTransaction(async () => {
            const answerFilter = await getModerationAnswerFilter(user, { Doubt }, id);
            const answer = await Answer.findOne(answerFilter)
                .session(transaction)
                .populate({ path: 'doubt', options: { session: transaction } });
            if (!answer || !answer.doubt)
                throw new ModerationRequestError('Answer or its doubt was not found', 404);
            if (answer.helper?._id?.toString() === session.user.id || answer.helper?.toString() === session.user.id)
                throw new ModerationRequestError('You cannot moderate your own answer', 403);
            if (answer.reviewAssignedTo && answer.reviewAssignedTo.toString() !== session.user.id)
                throw new ModerationRequestError('This review is assigned to another moderator', 409);
            const allowedStatuses = user.roles.includes('admin')
                ? ['PENDING', 'SUBMITTED', 'PENDING_REVIEW', 'ACCEPTED', 'FACULTY_PENDING', targetStatus]
                : ['FACULTY_PENDING', targetStatus];
            if (!allowedStatuses.includes(answer.status))
                throw new ModerationRequestError('This answer must be forwarded by a course representative before faculty review', 409);
            if (action === 'VERIFIED' && ['DUPLICATE', 'REJECTED'].includes(answer.doubt.status))
                throw new ModerationRequestError('Answers on duplicate or closed doubts cannot be published', 409);
            if (action === 'REJECTED' && answer.status === 'VERIFIED')
                throw new ModerationRequestError('A verified answer cannot be rejected', 409);
            if (action === 'VERIFIED' && answer.status === 'REJECTED')
                throw new ModerationRequestError('A rejected answer cannot be verified', 409);

            const transitioned = answer.status !== targetStatus;
            const actionAt = new Date();
            if (transitioned) {
                const awardReputation = action === 'VERIFIED'
                    && !(answer.isDemoData && answer.demoReputationAwarded);
                const updated = await Answer.findOneAndUpdate(
                    { _id: id, doubt: answer.doubt._id, status: answer.status, $or: [{ reviewAssignedTo: null }, { reviewAssignedTo: session.user.id }] },
                    {
                        $set: {
                            status: targetStatus,
                            ...(action === 'VERIFIED' ? {
                                verifiedBy: session.user.id,
                                verifiedAt: actionAt,
                                ...(answer.isDemoData ? { demoReputationAwarded: true } : {}),
                            } : {}),
                        },
                        $push: {
                            moderationHistory: {
                                moderator: session.user.id,
                                action,
                                reasonCategory,
                                reason,
                                rating: parsed.data.rating,
                                feedback: parsed.data.feedback,
                                createdAt: actionAt,
                            },
                        },
                    },
                    { new: true, session: transaction }
                );
                if (!updated)
                    throw new ModerationRequestError('Answer changed during review. Refresh and try again.', 409);
                if (awardReputation)
                    await User.updateOne({ _id: answer.helper?._id || answer.helper }, { $inc: { 'helperProfile.reputation': 10 } }, { session: transaction });
            }

            if (action === 'VERIFIED') {
                if (answer.doubt.status !== 'VERIFIED') {
                    const doubtUpdate = await Doubt.updateOne(
                        { _id: answer.doubt._id, status: { $in: ['OPEN', 'CLAIMED', 'ANSWERED'] } },
                        { $set: { status: 'VERIFIED' } },
                        { session: transaction }
                    );
                    if (doubtUpdate.matchedCount !== 1)
                        throw new ModerationRequestError('The doubt changed during review. Refresh and try again.', 409);
                }
                const priorVerification = answer.moderationHistory?.find((item) => item.action === 'VERIFIED');
                await KnowledgeEntry.findOneAndUpdate(
                    { answer: answer._id },
                    {
                        $setOnInsert: {
                            answer: answer._id,
                            doubt: answer.doubt._id,
                            verifiedBy: priorVerification?.moderator || session.user.id,
                            verifiedAt: priorVerification?.createdAt || actionAt,
                            title: answer.doubt.title,
                            course: answer.doubt.course,
                            topic: answer.doubt.topic,
                            question: answer.doubt.description,
                            answerContent: answer.content || answer.body || '',
                            tags: answer.doubt.tags || [],
                            ...(answer.isDemoData ? {
                                isDemoData: true,
                                demoKey: `${answer.demoKey}:knowledge`,
                            } : {}),
                        },
                    },
                    { upsert: true, new: true, setDefaultsOnInsert: true, session: transaction }
                );
            } else if (action === 'REJECTED') {
                await Doubt.updateOne(
                    { _id: answer.doubt._id, status: 'ANSWERED', assignedHelper: answer.helper?._id || answer.helper },
                    { $set: { status: 'CLAIMED' } },
                    { session: transaction }
                );
            }

            const priorAction = answer.moderationHistory?.find((item) => item.action === action);
            await recordModerationAction({
                entityType: 'answer',
                entityId: answer._id,
                action,
                moderator: transitioned ? session.user.id : (priorAction?.moderator || session.user.id),
                reasonCategory: transitioned ? reasonCategory : priorAction?.reasonCategory,
                reason,
                relatedEntity: answer.doubt._id,
                relatedEntityType: 'doubt',
                idempotencyKey: `answer:${id}:${action.toLowerCase()}`,
                isDemoData: Boolean(answer.isDemoData),
                demoKey: answer.isDemoData ? `${answer.demoKey}:moderation:${action.toLowerCase()}` : undefined,
                session: transaction,
            });
            result = {
                ok: true,
                status: targetStatus,
                knowledgePublished: action === 'VERIFIED',
                helperId: answer.helper?._id || answer.helper,
                studentId: answer.doubt.author,
                doubtId: answer.doubt._id,
                demoKey: answer.isDemoData ? `${answer.demoKey}:notification:${action.toLowerCase()}` : undefined,
            };
        });

        try {
            const type = action === 'VERIFIED'
                ? 'ANSWER_VERIFIED'
                : action === 'NEEDS_IMPROVEMENT' ? 'REVISION_REQUESTED' : 'ANSWER_REJECTED';
            const message = action === 'VERIFIED'
                ? `Your answer was verified by ${user.name} and published to the Knowledge Library.`
                : action === 'NEEDS_IMPROVEMENT'
                    ? `Faculty requested an improvement to your answer: ${reason}`
                    : `Your answer was rejected. ${reason}`;
            await notifyUsers(action === 'VERIFIED' ? [result.helperId, result.studentId] : [result.helperId], {
                type,
                doubt: result.doubtId,
                answer: id,
                message,
                href: `/doubts/${result.doubtId}#answer-${id}`,
                dedupeKey: `answer:${id}:${action.toLowerCase()}`,
                ...(result.demoKey ? { isDemoData: true, demoKey: result.demoKey } : {}),
            });
        } catch (notifyError) { console.error('ANSWER_MODERATION_NOTIFICATION_FAILED', { name: notifyError?.name || 'Error' }); }

        const { helperId: _helperId, studentId: _studentId, doubtId: _doubtId, demoKey: _demoKey, ...response } = result;
        return Response.json(response);
    } catch (err) {
        if (err instanceof ModerationRequestError)
            return Response.json({ msg: err.message }, { status: err.status });
        console.error('ANSWER_MODERATION_FAILED', { name: err?.name || 'Error', code: err?.code || 'UNKNOWN' });
        return Response.json({ msg: 'Could not complete moderation. Retry the action to safely finish it.' }, { status: 500 });
    } finally {
        if (transaction) await transaction.endSession();
    }
}
