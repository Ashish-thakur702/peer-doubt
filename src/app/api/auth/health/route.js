import { withApiErrors } from '@/lib/api-errors';
import connectDB from '@/lib/db';
import User from '@/models/User';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function response(body, status = 200) {
    return Response.json(body, {
        status,
        headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
}

async function handleGET() {
    const uri = process.env.MONGODB_URI?.trim();
    const isTemplateUri = uri?.includes('YOUR_CLUSTER') || /\/\/USERNAME:PASSWORD@/i.test(uri || '');

    if (!uri || isTemplateUri)
        return response({ available: false, issue: 'database_config_missing' }, 503);

    if (process.env.NODE_ENV === 'production' && (!process.env.NEXTAUTH_SECRET || !process.env.NEXTAUTH_URL))
        return response({ available: false, issue: 'auth_config_missing' }, 503);

    let timeout;
    try {
        const databaseCheck = (async () => {
            await connectDB();
            // Verify the app's database user can read the account collection too.
            await User.findOne({}).select('_id').maxTimeMS(5_000).lean();
        })();
        const deadline = new Promise((_, reject) => {
            timeout = setTimeout(() => {
                const error = new Error('MongoDB health check timed out.');
                error.code = 'MONGODB_CONNECT_TIMEOUT';
                reject(error);
            }, 12_000);
        });
        await Promise.race([databaseCheck, deadline]);
        return response({ available: true });
    } catch (error) {
        console.error('AUTH_HEALTH_CHECK_FAILED', {
            name: error?.name || 'Error',
            code: error?.code || error?.cause?.code || 'UNKNOWN',
            stack: error?.stack || 'No stack was provided',
        });
        const code = error?.code || error?.cause?.code;
        const message = error?.message || error?.cause?.message || '';
        const issue = code === 'MONGODB_CONFIG_MISSING'
            ? 'database_config_missing'
            : code === 'MONGODB_URI_INVALID'
                ? 'database_uri_invalid'
                : /query(?:Srv|Txt)|getaddrinfo/i.test(message)
                    ? 'database_dns_failed'
                    : code === 'MONGODB_CONNECT_TIMEOUT'
                        ? 'database_connection_timeout'
                : String(code) === '18'
                    || /MongoAuthenticationError/i.test(error?.name || '')
                    || /authentication failed|bad auth|sasl.*(fail|error)/i.test(message)
                    ? 'database_auth_failed'
                : 'database_unavailable';
        return response({ available: false, issue }, 503);
    } finally {
        clearTimeout(timeout);
    }
}

export const GET = withApiErrors(handleGET, { route: '/api/auth/health', method: 'GET' });
