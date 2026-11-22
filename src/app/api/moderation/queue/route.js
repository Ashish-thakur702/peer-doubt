import { withApiErrors } from '@/lib/api-errors';
import connectDB from '@/lib/db';
import Answer from '@/models/Answer';
import Doubt from '@/models/Doubt';
import Report from '@/models/Report';
import User from '@/models/User';
import { COURSES } from '@/lib/courses';
import { parsePagination } from '@/lib/moderation';
import { requirePermission } from '@/lib/session';
import { getModerationDoubtFilter, getModerationDoubtIds, getModerationReportFilter } from '@/lib/auth/scope.mjs';

async function handleGET(req) {
    const { user, error, status } = await requirePermission('canModerate');
    if (error) return Response.json({ msg: error }, { status });
    await connectDB();

    const url = new URL(req.url);
    const { page, limit, skip } = parsePagination(url.searchParams);
    const type = url.searchParams.get('type') || 'answers';
    if (!['answers', 'reports'].includes(type)) return Response.json({ msg: 'Unknown queue type' }, { status: 400 });

    if (type === 'reports') {
        const filter = { ...await getModerationReportFilter(user, { Doubt, Answer }), status: url.searchParams.get('status') || 'OPEN' };
        const [items, total] = await Promise.all([
            Report.find(filter).populate('reporter', 'name').sort({ createdAt: 1 }).skip(skip).limit(limit).lean(),
            Report.countDocuments(filter),
        ]);
        const compatibleItems = items.map((item) => ({
            ...item,
            content: item.content || item.body || '',
        }));
        return Response.json({ items: compatibleItems, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
    }

    const statusFilter = url.searchParams.get('status') || 'PENDING';
    const statusMap = { PENDING: ['PENDING', 'SUBMITTED', 'PENDING_REVIEW', 'ACCEPTED'], VERIFIED: ['VERIFIED'], REJECTED: ['REJECTED'] };
    if (!statusMap[statusFilter]) return Response.json({ msg: 'Unknown answer status' }, { status: 400 });
    const filter = { status: { $in: statusMap[statusFilter] } };
    const course = url.searchParams.get('course')?.trim();
    const topic = url.searchParams.get('topic')?.trim();
    const q = url.searchParams.get('q')?.trim().slice(0, 80);
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const doubtFilter = getModerationDoubtFilter(user);
    const scopedCourses = user.roles.includes('admin') ? null : (doubtFilter.course?.$in || []);
    if (course && Object.hasOwn(COURSES, course)) doubtFilter.course = course;
    if (topic) doubtFilter.topic = topic;
    if (q) doubtFilter.$text = { $search: q };
    if (course && !Object.hasOwn(COURSES, course)) return Response.json({ msg: 'Unknown course' }, { status: 400 });
    if (course && scopedCourses && !scopedCourses.includes(course)) return Response.json({ msg: 'This course is outside your moderation scope' }, { status: 403 });
    const filterDoubtIds = course || topic || q
        ? (await Doubt.find(doubtFilter).select('_id').limit(2000).lean()).map((doubt) => doubt._id)
        : await getModerationDoubtIds(user, Doubt);
    const filters = [];
    if (filterDoubtIds !== null) filter.doubt = { $in: filterDoubtIds };
    if (course || topic || q) filters.push({ doubt: { $in: filterDoubtIds || [] } });
    if (q) {
        const helpers = await User.find({ $text: { $search: q } }).select('_id').limit(200).lean();
        filters.push({ helper: { $in: helpers.map((helper) => helper._id) } });
    }
    if (filters.length) filter.$or = filters;
    if (from || to) {
        const createdAt = {};
        if (from) { const date = new Date(from); if (Number.isNaN(date.getTime())) return Response.json({ msg: 'Invalid start date' }, { status: 400 }); createdAt.$gte = date; }
        if (to) { const date = new Date(to); if (Number.isNaN(date.getTime())) return Response.json({ msg: 'Invalid end date' }, { status: 400 }); date.setUTCHours(23, 59, 59, 999); createdAt.$lte = date; }
        if (createdAt.$gte && createdAt.$lte && createdAt.$gte > createdAt.$lte) return Response.json({ msg: 'Start date must be on or before the end date' }, { status: 400 });
        filter.createdAt = createdAt;
    }
    const [items, total] = await Promise.all([
        Answer.find(filter)
            .populate('doubt', 'title description course topic status createdAt')
            .populate('helper', 'name roles helperProfile.reputation')
            .populate('reviewAssignedTo', 'name')
            .populate('moderationHistory.moderator', 'name')
            .sort({ createdAt: 1 }).skip(skip).limit(limit).lean(),
        Answer.countDocuments(filter),
    ]);
    return Response.json({ items, pagination: { page, limit, total, pages: Math.ceil(total / limit) }, filters: { courses: scopedCourses || Object.keys(COURSES), topics: course ? (COURSES[course] || []) : [...new Set(Object.values(COURSES).flat())] } });
}

export const GET = withApiErrors(handleGET, { route: '/api/moderation/queue', method: 'GET' });
