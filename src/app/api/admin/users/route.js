import mongoose from 'mongoose';
import { z } from 'zod';
import connectDB from '@/lib/db';
import Answer from '@/models/Answer';
import Doubt from '@/models/Doubt';
import ModerationLog from '@/models/ModerationLog';
import Report from '@/models/Report';
import User from '@/models/User';
import { COURSES } from '@/lib/courses';
import { parsePagination, validObjectId } from '@/lib/moderation';
import { requireRole } from '@/lib/session';
import { canRemoveActiveAdmin } from '@/lib/auth/policy.mjs';

const PROVISIONABLE_ROLES = ['student', 'cr', 'faculty', 'admin'];
const updateSchema = z.object({
    userId: z.string().regex(/^[a-f\d]{24}$/i),
    role: z.enum(PROVISIONABLE_ROLES).optional(),
    assignedCourses: z.array(z.enum(Object.keys(COURSES))).max(Object.keys(COURSES).length).optional(),
    department: z.string().trim().max(120).optional(),
    isSuspended: z.boolean().optional(),
    note: z.string().trim().min(3).max(1000),
}).refine((value) => value.role !== undefined || value.assignedCourses !== undefined || value.department !== undefined || value.isSuspended !== undefined, { message: 'Choose an account change' });

function accountRoles(role, helperEnabled) {
    if (!helperEnabled) return [role];
    return [...new Set([role, 'student', 'helper'])];
}

export async function GET(req) {
    const { session, error, status } = await requireRole('admin');
    if (error) return Response.json({ msg: error }, { status });
    await connectDB();
    const url = new URL(req.url);
    const { page, limit, skip } = parsePagination(url.searchParams);
    const q = url.searchParams.get('q')?.trim().slice(0, 80);
    const role = url.searchParams.get('role');
    const filter = {};
    if (q) filter.$text = { $search: q };
    if (role && PROVISIONABLE_ROLES.includes(role)) filter.$or = [{ roles: role }, { role }];
    const [users, total] = await Promise.all([
        User.find(filter).select('name email role roles isSuspended status isHelper courses availability helperProfile assignedCourses department createdAt').sort({ name: 1 }).skip(skip).limit(limit).lean(),
        User.countDocuments(filter),
    ]);
    const ids = users.map((user) => user._id);
    const [answers, doubts, reports, logs] = await Promise.all([
        Answer.aggregate([{ $match: { helper: { $in: ids } } }, { $group: { _id: '$helper', count: { $sum: 1 } } }]),
        Doubt.aggregate([{ $match: { author: { $in: ids } } }, { $group: { _id: '$author', count: { $sum: 1 } } }]),
        Report.aggregate([{ $match: { reporter: { $in: ids } } }, { $group: { _id: '$reporter', count: { $sum: 1 } } }]),
        ModerationLog.find({ moderator: { $in: ids } }).select('moderator action createdAt').sort({ createdAt: -1 }).lean(),
    ]);
    const counts = (items) => new Map(items.map((item) => [item._id.toString(), item.count]));
    const answerCounts = counts(answers), doubtCounts = counts(doubts), reportCounts = counts(reports);
    const activity = new Map();
    for (const item of logs) {
        const key = item.moderator.toString();
        const current = activity.get(key) || { moderationActions: 0, lastModerationAt: item.createdAt };
        current.moderationActions += 1;
        activity.set(key, current);
    }
    const items = users.map((user) => ({
        ...user,
        role: user.role || (user.roles || []).find((item) => item !== 'helper') || 'student',
        status: user.status || (user.isSuspended ? 'suspended' : 'active'),
        isHelper: Boolean(user.isHelper || user.helperProfile?.isHelper || user.helperProfile?.isWilling),
        courses: user.courses?.length ? user.courses : user.helperProfile?.courses || [],
        availability: Boolean(user.availability || user.helperProfile?.availability || user.helperProfile?.isWilling),
        activity: {
            answers: answerCounts.get(user._id.toString()) || 0,
            doubts: doubtCounts.get(user._id.toString()) || 0,
            reports: reportCounts.get(user._id.toString()) || 0,
            ...(activity.get(user._id.toString()) || { moderationActions: 0, lastModerationAt: null }),
        },
    }));
    return Response.json({ items, pagination: { page, limit, total, pages: Math.ceil(total / limit) }, viewerId: session.user.id });
}

export async function PATCH(req) {
    const { session, error, status } = await requireRole('admin');
    if (error) return Response.json({ msg: error }, { status });
    let body;
    try { body = await req.json(); } catch { return Response.json({ msg: 'Request body must be valid JSON' }, { status: 400 }); }
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return Response.json({ msg: parsed.error.issues[0].message }, { status: 400 });
    const { userId } = parsed.data;
    if (!validObjectId(userId)) return Response.json({ msg: 'User not found' }, { status: 404 });
    if (userId === session.user.id) return Response.json({ msg: 'You cannot change your own access' }, { status: 403 });

    await connectDB();
    const transaction = await mongoose.startSession();
    try {
        let changed;
        await transaction.withTransaction(async () => {
            // Serialize administrator changes against a shared actor record before counting admins.
            const actor = await User.findOneAndUpdate(
                { _id: session.user.id, $or: [{ roles: 'admin' }, { role: 'admin' }], status: { $ne: 'suspended' }, isSuspended: { $ne: true } },
                { $inc: { accessControlVersion: 1 } },
                { new: true, session: transaction }
            ).select('_id').lean();
            if (!actor) throw Object.assign(new Error('Administrator access changed. Sign in again.'), { status: 403 });

            const target = await User.findById(userId).select('role roles isSuspended status isHelper helperProfile assignedCourses department').session(transaction).lean();
            if (!target) throw Object.assign(new Error('User not found'), { status: 404 });

            const currentRole = target.role && target.role !== 'helper' ? target.role : (target.roles || []).find((item) => item !== 'helper') || 'student';
            const nextRole = parsed.data.role || currentRole;
            const assignedCourses = parsed.data.assignedCourses ?? target.assignedCourses ?? [];
            const department = parsed.data.department ?? target.department ?? '';
            if (nextRole === 'cr' && assignedCourses.length === 0)
                throw Object.assign(new Error('Assign at least one course to a course representative'), { status: 400 });
            if (nextRole === 'faculty' && (!department.trim() || assignedCourses.length === 0))
                throw Object.assign(new Error('Faculty access needs a department and at least one course'), { status: 400 });

            const helperEnabled = Boolean(target.isHelper || target.helperProfile?.isHelper || target.helperProfile?.isWilling || target.availability || target.helperProfile?.availability);
            const nextRoles = accountRoles(nextRole, helperEnabled);
            const nextSuspended = parsed.data.isSuspended ?? target.isSuspended ?? target.status === 'suspended';
            const removingActiveAdmin = (target.roles?.includes('admin') || target.role === 'admin') && !nextRoles.includes('admin');
            const suspendingActiveAdmin = (target.roles?.includes('admin') || target.role === 'admin') && nextSuspended && !(target.isSuspended || target.status === 'suspended');
            if (removingActiveAdmin || suspendingActiveAdmin) {
                const remainingAdmins = await User.countDocuments({
                    _id: { $ne: userId },
                    $or: [{ role: 'admin' }, { roles: 'admin' }],
                    isSuspended: { $ne: true },
                    status: { $ne: 'suspended' },
                }).session(transaction);
                if (!canRemoveActiveAdmin({ remainingActiveAdmins: remainingAdmins }))
                    throw Object.assign(new Error('The last active administrator cannot be demoted or suspended'), { status: 409 });
            }

            const update = {
                role: nextRole,
                roles: nextRoles,
                isSuspended: nextSuspended,
                status: nextSuspended ? 'suspended' : 'active',
            };
            if (parsed.data.role !== undefined || parsed.data.assignedCourses !== undefined) {
                update.assignedCourses = ['cr', 'faculty'].includes(nextRole) ? assignedCourses : [];
            }
            if (parsed.data.role !== undefined || parsed.data.department !== undefined) {
                update.department = nextRole === 'faculty' ? department : '';
            }
            changed = await User.findByIdAndUpdate(userId, { $set: update }, { new: true, session: transaction, runValidators: true }).select('name role roles status isSuspended assignedCourses department').lean();
            const actions = [];
            if (nextRole !== currentRole) actions.push({ action: 'USER_ROLE_CHANGED', reason: `Role changed from ${currentRole} to ${nextRole}. ${parsed.data.note}` });
            if (JSON.stringify([...(target.assignedCourses || [])].sort()) !== JSON.stringify([...(update.assignedCourses || target.assignedCourses || [])].sort()))
                actions.push({ action: 'USER_COURSES_ASSIGNED', reason: `Course scope updated. ${parsed.data.note}` });
            if ((target.department || '') !== (update.department ?? target.department ?? ''))
                actions.push({ action: 'USER_DEPARTMENT_UPDATED', reason: `Department updated. ${parsed.data.note}` });
            const wasSuspended = Boolean(target.isSuspended || target.status === 'suspended');
            if (nextSuspended !== wasSuspended)
                actions.push({ action: nextSuspended ? 'USER_SUSPENDED' : 'USER_REACTIVATED', reason: parsed.data.note });
            if (actions.length) await ModerationLog.create(actions.map(({ action, reason }) => ({
                entityType: 'user', entityId: userId, action, moderator: session.user.id,
                reason, relatedEntity: userId, relatedEntityType: 'user',
            })), { session: transaction });
        });
        return Response.json({ ok: true, user: changed });
    } catch (err) {
        return Response.json({ msg: err.status ? err.message : 'Could not save account changes' }, { status: err.status || 500 });
    } finally { await transaction.endSession(); }
}
