import { withApiErrors } from '@/lib/api-errors';
import { moderateAnswer } from '@/lib/answer-moderation';

async function handlePATCH(req, { params }) {
    return moderateAnswer(req, params, 'VERIFIED');
}

export const PATCH = withApiErrors(handlePATCH, { route: '/api/moderation/answers/[id]/verify', method: 'PATCH' });
