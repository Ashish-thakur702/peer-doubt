import { withApiErrors } from '@/lib/api-errors';
import connectDB from '@/lib/db';
import { getDuplicateSuggestions } from '@/lib/duplicate-suggestions';
import { parsePagination } from '@/lib/moderation';
import { requirePermission } from '@/lib/session';
import { getModerationDoubtFilter } from '@/lib/auth/scope.mjs';

async function handleGET(req) {
    const { user, error, status } = await requirePermission('canMarkDuplicate');
    if (error) return Response.json({ msg: error }, { status });
    await connectDB();

    const { page, limit } = parsePagination(new URL(req.url).searchParams);
    const suggestions = await getDuplicateSuggestions(240, getModerationDoubtFilter(user));
    return Response.json({
        items: suggestions.slice((page - 1) * limit, page * limit),
        pagination: { page, limit, total: suggestions.length, pages: Math.ceil(suggestions.length / limit) },
    });
}

export const GET = withApiErrors(handleGET, { route: '/api/moderation/duplicates', method: 'GET' });
