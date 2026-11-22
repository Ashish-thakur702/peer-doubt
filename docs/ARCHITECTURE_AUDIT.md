# unStuck architecture and reliability audit

## Scope and stack

This is a Next.js 16 App Router application under `src/app`, built with React 19 and JavaScript/JSX. Tailwind CSS 4 supplies utility styles; `src/app/globals.css` defines the dark editorial grid, lime accent, semantic colors, and reusable component styles. There is no component library and no Server Actions.

The backend uses Next.js Route Handlers, Mongoose 9, and MongoDB. `src/lib/db.js` owns the process-level cached connection. `src/models` defines User, Doubt, Answer, Report, Notification, ModerationLog, KnowledgeEntry, AnswerFeedback, and KnowledgeBookmark. NextAuth 4 Credentials uses JWT sessions; server layouts and API guards reload current role and status from MongoDB. `src/proxy.js` checks only whether a session token exists and redirects unauthenticated requests; role authorization remains in server layouts and handlers.

## Page routes and flows

| Route | Flow |
| --- | --- |
| `/` | Product landing page and sign-in / registration entry points |
| `/login`, `/register`, `/access-denied` | Credentials sign-in, student registration, authorization fallback |
| `/doubts/mine`, `/doubts/new`, `/doubts/[id]` | Ask, list, edit, follow, rate, report, and accept an answer |
| `/helper`, `/helper/profile` | Opt into helping, choose courses/topics, claim questions, submit or revise answers |
| `/moderation`, `/moderation/answers`, `/moderation/reports`, `/moderation/duplicates`, `/moderation/history` | Review answers, reports, duplicate suggestions, and audit history |
| `/knowledge`, `/knowledge/saved`, `/knowledge/[id]` | Search, read, bookmark, and archive verified explanations |
| `/notifications` | Read and manage account notifications |
| `/admin/users`, `/admin/audit` | Provision roles/scopes, suspend accounts, and inspect access changes |

## Route Handler inventory

- **Authentication:** `GET|POST /api/auth/[...nextauth]`, `GET /api/auth/health`, `GET /api/auth/me`, `POST /api/auth/register`.
- **Doubts:** `GET|POST /api/doubts`, `GET|PATCH /api/doubts/[id]`, `GET /api/doubts/similar`, `POST /api/doubts/[id]/claim`, `POST /api/doubts/[id]/answers`, `PATCH /api/doubts/[id]/duplicate`, `PUT /api/doubts/[id]/rating`.
- **Answers:** `PATCH /api/answers/[id]`, `PATCH /api/answers/[id]/accept`, `GET|PUT /api/answers/[id]/feedback`.
- **Helper:** `GET /api/helper/feed`, `GET /api/helper/doubts`, `GET /api/helper/analytics`, `GET|PATCH /api/users/helper-profile`.
- **Moderation:** `GET /api/moderation/stats`, `GET /api/moderation/queue`, `GET /api/moderation/history`, `GET /api/moderation/duplicates`, `PATCH /api/moderation/answers/[id]/verify|reject|revise|reconsider`, `PUT|DELETE /api/moderation/answers/[id]/assign`.
- **Reports:** `POST /api/reports`, `GET /api/reports`, `PATCH /api/reports/[id]`.
- **Knowledge:** `GET /api/knowledge`, `GET|PATCH /api/knowledge/[id]`, `PUT /api/knowledge/[id]/bookmark`, `GET /api/knowledge/bookmarks`.
- **Notifications and administration:** `GET|PATCH /api/notifications`, `PATCH /api/notifications/[id]`, `GET|PATCH /api/admin/users`.

## Initial reliability findings

1. `MONGODB_URI` and auth settings had been edited into the tracked `.env.example`; Next.js does not load that filename. Local credentials belong in ignored `.env.local`. The sample file has been restored, and the working values were copied to `.env.local` without printing them.
2. `connectDB` caches a promise, but uses an implicit `global._mongoose` key, validates only whether the URI exists, and omits socket / pool-wait timeouts. The public auth health request has returned both success and `ETIMEOUT` during this session, so Atlas availability is intermittent even after the environment file is loaded.
3. API handlers use mixed error contracts and many rely on uncaught route exceptions for database failures. Some feature helpers already catch and log failures, but that behavior is not uniform.
4. Client fetches have no shared timeout. Most forms use `finally`, while some actions do not catch network errors or explain failed responses; a request that never settles can leave controls busy indefinitely.
5. There were no app-level `error`, `global-error`, `not-found`, or root `loading` files. Server-rendered Mongo failures and unexpected client render errors therefore lacked a branded recovery view.
6. Browser storage reads/writes in the theme provider can throw when storage is unavailable. A failed role refresh in the navbar replaces display roles with an empty list even though server-side checks remain authoritative.
7. The landing page included fixed activity metrics and a sample question labeled “Live question,” which can read as live database data. Date formatting in several screens assumes database dates are valid.
8. The dark grid and lime brand are established, but status colors, surfaces, radii, and spacing are only partly tokenized; reusable loading, alert, and action states vary between features.

## Authorization boundaries

Protected page layouts call `requireAuth`, `requireRole`, or `requirePermission`. API handlers use the same current-user checks and moderation scope helpers. Public registration creates student accounts only. The admin API owns privileged role, course-scope, and suspension changes; helper access is a student opt-in. NextAuth JWT fields support display and routing only; current database state governs authorization.

## Completed remediation

1. Hardened the cached Mongo connection with URI validation, explicit database selection, bounded server-selection / connect / socket / pool-wait timeouts, and safe connection diagnostics. Local credentials remain in ignored `.env.local`; `.env.example` contains placeholders.
2. Added a no-store auth health endpoint that checks both the database connection and account collection permissions, with a 12-second overall deadline. It reports missing / malformed configuration, rejected credentials, DNS SRV failures, timeouts, and unreachable service as distinct safe issue codes. Login and registration show corrective guidance without returning the URI or database error details.
3. Wrapped 44 Route Handler methods across 35 route files in shared structured error handling with server-side request identifiers and database / validation error classification. Existing route-level authorization and scopes remain in place.
4. Added a 25-second browser request bound, bounded credential sign-in, safe theme storage access, current-role fallback in navigation, explicit retry for feedback / insight / knowledge loads, and recovery for notification actions.
5. Added root and feature error boundaries, a global error page, not-found states, and a root loading state. Date formatting now handles missing / malformed values in a consistent Asia/Kolkata display.
6. Extended the design tokens and shared surfaces for the established dark grid and lime campus-learning brand. Reworked the auth experience into an editorial split layout, removed fixed activity counts presented as live data, and relabeled sample content clearly.

## Verification

- `npm.cmd run lint` — passed with no warnings.
- `npm.cmd run typecheck` — passed.
- `npm.cmd test` — 16 passed, 0 failed. The public route inventory includes the intentionally unauthenticated database health endpoint.
- `npm.cmd run build` — passed; Next generated all 38 static pages and listed every App Router page and API route.
- `git diff --check` — passed; Git only reported expected line-ending normalization warnings.
- Environment hygiene check — `.env.example` has no configured credentials and `.env.local` is ignored by Git.

Atlas connectivity is external to this repository. The local configuration parses, names the `peer_doubt_app` user, and selects the `Doubt` database. Windows resolved three Atlas SRV records, but TCP checks to the returned MongoDB nodes failed; the Node process also logged an intermittent `querySrv ETIMEOUT`. This points to Atlas IP access-list or outbound network reachability, rather than a missing environment variable or absent database user. The health endpoint now returns the issue category needed to distinguish these cases; no database records were initialized, seeded, or changed during this work.
