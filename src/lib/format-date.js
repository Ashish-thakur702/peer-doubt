const INDIA_TIME_ZONE = 'Asia/Kolkata';

function asDate(value) {
    if (value === null || value === undefined || value === '') return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value, fallback = 'Date unavailable') {
    const date = asDate(value);
    if (!date) return fallback;
    return new Intl.DateTimeFormat('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: INDIA_TIME_ZONE,
    }).format(date);
}

export function formatDateTime(value, fallback = 'Time unavailable') {
    const date = asDate(value);
    if (!date) return fallback;
    return new Intl.DateTimeFormat('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: INDIA_TIME_ZONE,
    }).format(date);
}
