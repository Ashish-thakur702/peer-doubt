import { withApiErrors } from '@/lib/api-errors';
import { moderateAnswer } from '@/lib/answer-moderation';

async function handlePATCH(req, { params }) {
    return moderateAnswer(req, params, 'NEEDS_IMPROVEMENT');
}

export const PATCH = withApiErrors(handlePATCH, { route: '/api/moderation/answers/[id]/needs-improvement', method: 'PATCH' });
