import { withApiErrors } from '@/lib/api-errors';
import connectDB from '@/lib/db';
import Answer from '@/models/Answer';
import Doubt from '@/models/Doubt';
import Report from '@/models/Report';
import ModerationLog from '@/models/ModerationLog';
import KnowledgeEntry from '@/models/KnowledgeEntry';
import { getDuplicateSuggestions } from '@/lib/duplicate-suggestions';
import { requirePermission } from '@/lib/session';
import { getModerationDoubtFilter, getModerationDoubtIds, getModerationLogFilter, getModerationReportFilter } from '@/lib/auth/scope.mjs';

async function handleGET() {
    const { user, error, status } = await requirePermission('canModerate');
    if (error) return Response.json({ msg: error }, { status });
    await connectDB();

    const doubtIds = await getModerationDoubtIds(user, Doubt);
    const scopedDoubts = doubtIds === null ? {} : { _id: { $in: doubtIds } };
    const scopedAnswers = doubtIds === null ? {} : { doubt: { $in: doubtIds } };
    const scopedReports = await getModerationReportFilter(user, { Doubt, Answer });
    const scopedLogs = await getModerationLogFilter(user, { Doubt, Answer });
    const scopedCourses = getModerationDoubtFilter(user);

    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const activeKnowledge = [
        { $match: { ...scopedCourses, $or: [{ status: 'ACTIVE' }, { status: { $exists: false } }] } },
        { $lookup: { from: 'answers', let: { answerId: '$answer' }, pipeline: [
            { $match: { $expr: { $and: [{ $eq: ['$_id', '$$answerId'] }, { $eq: ['$status', 'VERIFIED'] }, { $ne: ['$flaggedForReview', true] }] } } },
            { $project: { _id: 1 } },
        ], as: 'validAnswer' } },
        { $lookup: { from: 'doubts', let: { doubtId: '$doubt' }, pipeline: [
            { $match: { $expr: { $and: [{ $eq: ['$_id', '$$doubtId'] }, { $ne: ['$flaggedForReview', true] }, { $not: [{ $in: ['$status', ['DUPLICATE', 'REJECTED']] }] }] } } },
            { $project: { _id: 1 } },
        ], as: 'validDoubt' } },
        { $match: { 'validAnswer.0': { $exists: true }, 'validDoubt.0': { $exists: true } } },
    ];
    const [pendingAnswers, verifiedAnswers, rejectedAnswers, openReports, verifiedThisWeek, duplicateDoubts, potentialDuplicatePairs, recentActivity, resolvedReports, verification, activity, knowledgeByCourse, knowledgeByTopic] = await Promise.all([
        Answer.countDocuments({ ...scopedAnswers, status: { $in: ['PENDING', 'SUBMITTED', 'PENDING_REVIEW', 'ACCEPTED'] } }),
        Answer.countDocuments({ ...scopedAnswers, status: 'VERIFIED' }),
        Answer.countDocuments({ ...scopedAnswers, status: 'REJECTED' }),
        Report.countDocuments({ ...scopedReports, status: 'OPEN' }),
        Answer.countDocuments({ ...scopedAnswers, status: 'VERIFIED', moderationHistory: { $elemMatch: { action: 'VERIFIED', createdAt: { $gte: since } } } }),
        Doubt.countDocuments({ ...scopedDoubts, status: 'DUPLICATE' }),
        getDuplicateSuggestions(240, scopedCourses).then((items) => items.length),
        ModerationLog.find({ ...scopedLogs, entityType: { $ne: 'user' } }).populate('moderator', 'name').sort({ createdAt: -1 }).limit(6).lean(),
        Report.countDocuments({ ...scopedReports, status: 'RESOLVED' }),
        Answer.aggregate([
            { $match: { ...scopedAnswers, status: 'VERIFIED' } }, { $unwind: '$moderationHistory' },
            { $match: { 'moderationHistory.action': 'VERIFIED' } },
            { $group: { _id: '$_id', duration: { $first: { $subtract: ['$moderationHistory.createdAt', '$createdAt'] } } } },
            { $group: { _id: null, averageMs: { $avg: '$duration' } } },
        ]),
        ModerationLog.aggregate([
            { $match: { ...scopedLogs, createdAt: { $gte: monthAgo }, entityType: { $ne: 'user' } } },
            { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
            { $sort: { _id: 1 } },
        ]),
        KnowledgeEntry.aggregate([...activeKnowledge, { $group: { _id: '$course', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
        KnowledgeEntry.aggregate([...activeKnowledge, { $group: { _id: '$topic', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 10 }]),
    ]);

    return Response.json({ stats: {
        pendingAnswers, verifiedAnswers, rejectedAnswers, openReports, verifiedThisWeek, duplicateDoubts, potentialDuplicatePairs,
        resolvedReports, averageVerificationHours: verification[0]?.averageMs ? Math.round(verification[0].averageMs / 360000) / 10 : null,
        knowledgeEntries: knowledgeByCourse.reduce((sum, item) => sum + item.count, 0),
    }, activity, knowledgeByCourse, knowledgeByTopic, recentActivity });
}

export const GET = withApiErrors(handleGET, { route: '/api/moderation/stats', method: 'GET' });
