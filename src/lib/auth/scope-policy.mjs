import { hasRole } from './roles.mjs';

const COURSE_DEPARTMENTS = Object.freeze({
    DAA: 'Computer Science',
    OS: 'Computer Science',
    DBMS: 'Computer Science',
    CN: 'Computer Science',
});

export function getModerationCourses(user, courseMap) {
    if (hasRole(user, 'admin')) return null;
    if (hasRole(user, 'faculty')) {
        const assigned = user.assignedCourses || [];
        if (assigned.length) return [...new Set(assigned.filter((course) => courseMap[course]))];
        const department = user.department?.trim().toLowerCase();
        if (!department) return [];
        return Object.keys(courseMap).filter((course) => COURSE_DEPARTMENTS[course]?.toLowerCase() === department);
    }
    if (hasRole(user, 'cr')) return [...new Set((user.assignedCourses || []).filter((course) => courseMap[course]))];
    return [];
}

export function hasModerationCourseAccess(user, course, courseMap) {
    const courses = getModerationCourses(user, courseMap);
    return courses === null || courses.includes(course);
}
