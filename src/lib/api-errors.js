import 'server-only';

const DUPLICATE_KEY = 11000;
const DATABASE_CODES = new Set([
    'ECONNRESET',
    'ECONNREFUSED',
    'ENOTFOUND',
    'ETIMEOUT',
    'MONGODB_CONFIG_MISSING',
    'MONGODB_URI_INVALID',
]);

function classify(error) {
    if (error?.code === DUPLICATE_KEY)
        return { status: 409, code: 'DUPLICATE_RECORD', msg: 'This record already exists or was changed by another request.' };

    const errorCode = String(error?.code || error?.cause?.code || '');
    const errorMessage = error?.message || error?.cause?.message || '';
    if (/query(?:Srv|Txt)|getaddrinfo/i.test(errorMessage))
        return { status: 503, code: 'DATABASE_DNS_FAILED', msg: 'The MongoDB host could not be resolved. Check the Atlas hostname and whether this network allows DNS SRV lookups.' };
    if (errorCode === 'MONGODB_CONNECT_TIMEOUT')
        return { status: 503, code: 'DATABASE_TIMEOUT', msg: 'MongoDB did not respond in time. Check Atlas availability and this app host’s network or DNS access.' };
    const authFailure = errorCode === '18'
        || /MongoAuthenticationError/i.test(error?.name || '')
        || /authentication failed|bad auth|sasl.*(fail|error)/i.test(errorMessage);
    if (authFailure)
        return { status: 503, code: 'DATABASE_AUTH_FAILED', msg: 'The application database credentials were rejected. Check the database user and encoded password.' };
    if (DATABASE_CODES.has(errorCode) || /MongoServerSelection|MongooseServerSelection|MongoNetwork/i.test(error?.name || ''))
        return { status: 503, code: 'DATABASE_UNAVAILABLE', msg: 'The data service is temporarily unavailable. Please retry.' };

    if (error?.name === 'ValidationError' || error?.name === 'CastError')
        return { status: 400, code: 'INVALID_DATA', msg: 'Some submitted data is invalid. Review it and try again.' };

    return { status: 500, code: 'INTERNAL_ERROR', msg: 'The request could not be completed. Please try again.' };
}

export function withApiErrors(handler, { route, method }) {
    return async (...args) => {
        try {
            return await handler(...args);
        } catch (error) {
            const request = args.find((arg) => arg && typeof arg.headers?.get === 'function');
            const requestId = request?.headers?.get('x-request-id') || globalThis.crypto?.randomUUID?.();
            const diagnosticCode = error?.code || error?.cause?.code || 'UNKNOWN';
            console.error('API_ROUTE_FAILED', {
                route,
                method,
                requestId: requestId || 'unavailable',
                name: error?.name || 'Error',
                code: diagnosticCode,
                stack: error?.stack || 'No stack was provided',
            });

            const response = classify(error);
            return Response.json({ msg: response.msg, code: response.code, requestId: requestId || undefined }, {
                status: response.status,
                headers: { 'Cache-Control': 'no-store' },
            });
        }
    };
}
