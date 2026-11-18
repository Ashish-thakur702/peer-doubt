import { COURSES } from '../courses.js';
import { getModerationCourses as getScopedCourses, hasModerationCourseAccess as hasCourseAccess } from './scope-policy.mjs';

export function getModerationCourses(user) {
    return getScopedCourses(user, COURSES);
}

export function hasModerationCourseAccess(user, course) {
    return hasCourseAccess(user, course, COURSES);
}

export function getModerationDoubtFilter(user) {
    const courses = getModerationCourses(user);
    return courses === null ? {} : courses.length ? { course: { $in: courses } } : { _id: null };
}

export async function getModerationDoubtIds(user, Doubt) {
    const courses = getModerationCourses(user);
    if (courses === null) return null;
    if (!courses.length) return [];
    return Doubt.distinct('_id', { course: { $in: courses } });
}

export async function getModerationAnswerFilter(user, { Doubt }, answerId) {
    const doubtIds = await getModerationDoubtIds(user, Doubt);
    return { _id: answerId, ...(doubtIds === null ? {} : { doubt: { $in: doubtIds } }) };
}

export async function getModerationReportFilter(user, { Doubt, Answer }) {
    const doubtIds = await getModerationDoubtIds(user, Doubt);
    if (doubtIds === null) return {};
    if (!doubtIds.length) return { _id: null };
    const answerIds = await Answer.distinct('_id', { doubt: { $in: doubtIds } });
    return {
        $or: [
            { targetType: 'doubt', target: { $in: doubtIds } },
            { targetType: 'answer', target: { $in: answerIds } },
        ],
    };
}

export async function getModerationLogFilter(user, { Doubt, Answer }) {
    const doubtIds = await getModerationDoubtIds(user, Doubt);
    if (doubtIds === null) return {};
    if (!doubtIds.length) return { _id: null };
    const answerIds = await Answer.distinct('_id', { doubt: { $in: doubtIds } });
    return {
        $or: [
            { entityType: 'doubt', entityId: { $in: doubtIds } },
            { entityType: 'answer', entityId: { $in: answerIds } },
            { entityType: 'report', relatedEntity: { $in: [...doubtIds, ...answerIds] } },
            { entityType: 'knowledge', relatedEntity: { $in: answerIds } },
        ],
    };
}
