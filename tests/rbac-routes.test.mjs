import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../src/app/api', import.meta.url));

function routeFiles(directory) {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = join(directory, entry.name);
        return entry.isDirectory() ? routeFiles(path) : entry.name === 'route.js' ? [path] : [];
    });
}

test('every non-public API route declares a fresh-session guard or delegates to the shared guarded moderator', () => {
    const publicRoutes = new Set(['auth/register/route.js', 'auth/health/route.js', 'auth/[...nextauth]/route.js']);
    const unguarded = routeFiles(root).map((path) => ({ path, source: readFileSync(path, 'utf8') }))
        .filter(({ path, source }) => {
            const route = relative(root, path).replaceAll('\\', '/');
            return !publicRoutes.has(route)
                && !/requireRole|requirePermission|requireAuth|moderateAnswer\(/.test(source);
        });
    assert.deepEqual(unguarded.map(({ path }) => relative(root, path)), []);
});

test('verify and reject handlers delegate to the shared current-database permission guard', () => {
    const moderation = readFileSync(new URL('../src/lib/answer-moderation.js', import.meta.url), 'utf8');
    const verify = readFileSync(new URL('../src/app/api/moderation/answers/[id]/verify/route.js', import.meta.url), 'utf8');
    const reject = readFileSync(new URL('../src/app/api/moderation/answers/[id]/reject/route.js', import.meta.url), 'utf8');
    assert.match(verify, /moderateAnswer/);
    assert.match(reject, /moderateAnswer/);
    assert.match(moderation, /requirePermission\('canVerifyAnswer'\)/);
    assert.match(moderation, /getModerationAnswerFilter/);
});

test('each sensitive route group uses its intended permission', () => {
    const contracts = [
        ['moderation/queue/route.js', /requirePermission\('canModerate'\)/],
        ['moderation/stats/route.js', /requirePermission\('canModerate'\)/],
        ['moderation/history/route.js', /requirePermission\('canModerate'\)/],
        ['moderation/answers/[id]/assign/route.js', /requirePermission\('canModerate'\)/],
        ['moderation/answers/[id]/revise/route.js', /requirePermission\('canModerate'\)/],
        ['moderation/answers/[id]/reconsider/route.js', /requirePermission\('canReconsiderRejected'\)/],
        ['moderation/duplicates/route.js', /requirePermission\('canMarkDuplicate'\)/],
        ['doubts/[id]/duplicate/route.js', /requirePermission\('canMarkDuplicate'\)/],
        ['reports/route.js', /requirePermission\('canReviewReports'\)/],
        ['reports/[id]/route.js', /requirePermission\('canReviewReports'\)/],
        ['knowledge/[id]/route.js', /requirePermission\('canArchiveKnowledge'\)/],
        ['admin/users/route.js', /requireRole\('admin'\)/],
    ];
    for (const [route, guard] of contracts) {
        const source = readFileSync(join(root, route), 'utf8');
        assert.match(source, guard, route);
    }
});

test('admin access route protects self changes and checks the remaining administrator count', () => {
    const route = readFileSync(new URL('../src/app/api/admin/users/route.js', import.meta.url), 'utf8');
    assert.match(route, /userId === session\.user\.id/);
    assert.match(route, /canRemoveActiveAdmin/);
    assert.match(route, /remainingAdmins/);
});
