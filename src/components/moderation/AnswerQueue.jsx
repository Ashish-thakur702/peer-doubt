'use client';
import { fetchWithTimeout } from '@/lib/client-fetch';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import StatusBadge from '@/components/StatusBadge';
import { COURSES } from '@/lib/courses';
import { formatDateTime } from '@/lib/format-date';

const STATUSES = ['PENDING', 'VERIFIED', 'REJECTED'];

export default function AnswerQueue({ initialStatus = 'PENDING', initialPage = '', initialFilters = { q: '', course: '', topic: '', from: '', to: '' } }) {
    const { data: session } = useSession();
    const roles = session?.user?.roles || [];
    const isCr = roles.includes('cr') && !roles.includes('faculty') && !roles.includes('admin');
    const [items, setItems] = useState([]);
    const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
    const [page, setPage] = useState(() => Math.max(1, Number.parseInt(initialPage, 10) || 1));
    const [statusFilter, setStatusFilter] = useState(STATUSES.includes(initialStatus) ? initialStatus : 'PENDING');
    const [filters, setFilters] = useState(initialFilters);
    const [reasons, setReasons] = useState({});
    const [categories, setCategories] = useState({});
    const [ratings, setRatings] = useState({});
    const [busy, setBusy] = useState('');
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const params = new URLSearchParams({ type: 'answers', page: String(page), limit: '20', status: statusFilter });
            Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value); });
            const res = await fetchWithTimeout(`/api/moderation/queue?${params}`);
            const json = await res.json();
            if (!res.ok) throw new Error(json.msg || 'Could not load answers.');
            setItems(json.items || []);
            setPagination(json.pagination || { page, pages: 1, total: json.items?.length || 0 });
        } catch (err) { setError(err.message); }
        finally { setLoading(false); }
    }, [page, statusFilter, filters]);

    useEffect(() => {
        const timer = setTimeout(load, 200);
        return () => clearTimeout(timer);
    }, [load]);

    useEffect(() => {
        if (statusFilter !== 'PENDING') return undefined;
        const interval = setInterval(load, 7000);
        return () => clearInterval(interval);
    }, [load, statusFilter]);

    useEffect(() => {
        const params = new URLSearchParams();
        if (statusFilter !== 'PENDING') params.set('status', statusFilter);
        Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value); });
        if (page > 1) params.set('page', String(page));
        const query = params.toString();
        window.history.replaceState(window.history.state, '', query ? `/moderation/answers?${query}` : '/moderation/answers');
    }, [filters, page, statusFilter]);

    async function review(answer, action) {
        setError(''); setMessage('');
        const reason = (reasons[answer._id] || '').trim();
        const category = categories[answer._id];
        if (action === 'reject' && (!category || reason.length < 3)) {
            setError('Choose a rejection reason and add a short explanation.');
            return;
        }
        if (action === 'reconsider' && reason.length < 3) {
            setError('Add a short note explaining why the answer should be reopened.');
            return;
        }
        if (!isCr && action !== 'reject' && reason.length < 3) {
            setError('Add written feedback before saving this faculty review.');
            return;
        }
        if (!isCr && action !== 'reconsider' && !ratings[answer._id]) {
            setError('Choose a 1–5 star rating before saving this faculty review.');
            return;
        }
        setBusy(answer._id);
        try {
            let res;
            if (isCr) {
                res = await fetchWithTimeout(`/api/moderation/answers/${answer._id}/forward`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(action === 'reject'
                        ? { decision: 'REJECT', category, note: reason }
                        : { decision: 'FORWARD' }),
                });
            } else {
                const route = action === 'needs-improvement' ? 'needs-improvement' : action;
                res = await fetchWithTimeout(`/api/moderation/answers/${answer._id}/${route}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: action === 'reconsider'
                        ? JSON.stringify({ note: reason })
                        : JSON.stringify(action === 'reject'
                        ? { category, rating: ratings[answer._id], feedback: reason }
                        : { rating: ratings[answer._id], feedback: reason }),
                });
            }
            const json = await res.json();
            if (!res.ok) throw new Error(json.msg || 'Could not save this decision.');
            setMessage(isCr
                ? (action === 'reject' ? 'Answer rejected and the helper was notified.' : 'Answer approved and forwarded to faculty.')
                : action === 'verify' ? 'Answer verified and added to the knowledge library; the helper and student were notified.'
                    : action === 'reject' ? 'Answer rejected. The reason was recorded and the helper was notified.'
                        : 'Needs-improvement feedback was sent to the helper.');
            await load();
        } catch (err) { setError(err.message); }
        finally { setBusy(''); }
    }

    async function markDuplicate(answer) {
        setBusy(answer._id); setError(''); setMessage('');
        try {
            const params = new URLSearchParams({
                q: answer.doubt?.title || '',
                course: answer.doubt?.course || '',
                topic: answer.doubt?.topic || '',
            });
            const matchesResponse = await fetchWithTimeout(`/api/doubts/similar?${params}`);
            const matches = await matchesResponse.json();
            if (!matchesResponse.ok) throw new Error(matches.msg || 'Could not find a verified original doubt.');
            const original = matches.find((item) => item._id !== answer.doubt?._id);
            if (!original) throw new Error('No verified matching doubt was found. Use Duplicate doubts to compare this question manually.');
            const response = await fetchWithTimeout(`/api/doubts/${answer.doubt._id}/duplicate`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ decision: 'CONFIRM', originalDoubtId: original._id }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.msg || 'Could not mark this doubt as a duplicate.');
            setMessage(`Doubt marked as a duplicate of “${original.title}”.`);
            await load();
        } catch (err) { setError(err.message); }
        finally { setBusy(''); }
    }

    async function assign(answer) {
        setBusy(answer._id); setError(''); setMessage('');
        try {
            const response = await fetchWithTimeout(`/api/moderation/answers/${answer._id}/assign`, { method: 'PUT' });
            const data = await response.json();
            if (!response.ok) throw new Error(data.msg || 'Could not assign this review.');
            setMessage('Review assigned to you.');
            await load();
        } catch (err) { setError(err.message); }
        finally { setBusy(''); }
    }

    async function release(answer) {
        setBusy(answer._id); setError(''); setMessage('');
        try {
            const response = await fetchWithTimeout(`/api/moderation/answers/${answer._id}/assign`, { method: 'DELETE' });
            const data = await response.json();
            if (!response.ok) throw new Error(data.msg || 'Could not release this review.');
            setMessage('Review assignment released.');
            await load();
        } catch (err) { setError(err.message); }
        finally { setBusy(''); }
    }

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div><h2 className="text-xl font-bold">{isCr ? 'CR moderation queue' : 'Faculty verification queue'}</h2><p className="mt-1 text-sm text-graphite">{isCr ? 'Review new helper answers, then forward suitable answers to faculty.' : 'Rate the explanation, leave feedback, and make the final verification decision.'}</p></div>
                <span className="rounded-full bg-marker px-3 py-1 text-xs font-semibold text-ink">{loading ? 'Loading queue' : `${items.length} waiting`}</span>
            </div>
            <div role="tablist" aria-label="Answer status" className="flex flex-wrap gap-2">
                {STATUSES.map((value) => <button key={value} type="button" role="tab" aria-selected={statusFilter === value} className={statusFilter === value ? 'btn-primary' : 'btn-quiet'} onClick={() => { setStatusFilter(value); setPage(1); }}>{value === 'PENDING' ? 'Pending' : value === 'VERIFIED' ? 'Verified' : 'Rejected'}</button>)}
            </div>
            <section className="card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Filter moderation queue">
                <label className="text-xs font-semibold text-graphite">Search doubt or helper<input className="field mt-1" value={filters.q} maxLength={80} onChange={(event) => { setFilters((current) => ({ ...current, q: event.target.value })); setPage(1); }} placeholder="Title, description, helper" /></label>
                <label className="text-xs font-semibold text-graphite">Course<select className="field mt-1" value={filters.course} onChange={(event) => { setFilters((current) => ({ ...current, course: event.target.value, topic: '' })); setPage(1); }}><option value="">All courses</option>{Object.keys(COURSES).map((course) => <option key={course}>{course}</option>)}</select></label>
                <label className="text-xs font-semibold text-graphite">Topic<select className="field mt-1" value={filters.topic} onChange={(event) => { setFilters((current) => ({ ...current, topic: event.target.value })); setPage(1); }}><option value="">All topics</option>{(filters.course ? COURSES[filters.course] : [...new Set(Object.values(COURSES).flat())]).map((topic) => <option key={topic}>{topic}</option>)}</select></label>
                <label className="text-xs font-semibold text-graphite">Submitted from<input type="date" className="field mt-1" value={filters.from} onChange={(event) => { setFilters((current) => ({ ...current, from: event.target.value })); setPage(1); }} /></label>
                <label className="text-xs font-semibold text-graphite">Submitted to<input type="date" className="field mt-1" value={filters.to} onChange={(event) => { setFilters((current) => ({ ...current, to: event.target.value })); setPage(1); }} /></label>
                <button type="button" className="btn-quiet self-end" onClick={() => { setFilters({ q: '', course: '', topic: '', from: '', to: '' }); setPage(1); }}>Clear filters</button>
            </section>
            {message && <p className="rounded-xl border border-verified/30 bg-verified/10 p-3 text-sm text-verified" role="status">{message}</p>}
            {error && <p className="rounded-xl border border-margin/30 bg-margin/10 p-3 text-sm text-margin" role="alert">{error}</p>}
            {loading ? <div className="space-y-3" aria-label="Loading answer queue">{[1, 2].map((item) => <div key={item} className="card h-64 animate-pulse bg-sheet" />)}</div> : null}
            {!loading && !error && items.length === 0 && <div className="card px-5 py-12 text-center"><span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-verified/10 text-xl text-verified" aria-hidden="true">✓</span><h3 className="mt-4 font-bold">Queue is clear</h3><p className="mx-auto mt-1 max-w-md text-sm leading-6 text-graphite">There are no answers waiting for review. New helper submissions will show up here.</p></div>}

            {!loading && items.map((answer) => (
                <article key={answer._id} className="card overflow-hidden">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule bg-paper/70 px-4 py-3 sm:px-5">
                            <div className="flex flex-wrap items-center gap-2">
                                <StatusBadge status={answer.status} />
                                {answer.status === 'VERIFIED' && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-verified/10 px-2.5 py-0.5 text-xs font-semibold text-verified motion-safe:animate-pulse">
                                        ✓ Verified by {answer.verifiedBy?.name || 'Faculty'}
                                    </span>
                                )}
                                <span className="text-xs text-graphite">Submitted {formatDateTime(answer.createdAt)}</span>
                                {answer.reviewAssignedTo && <span className="text-xs text-graphite">Assigned to {answer.reviewAssignedTo.name || 'Moderator'}</span>}
                            </div>
                        {answer.doubt?._id && <Link href={`/doubts/${answer.doubt._id}`} className="text-sm font-semibold text-pencil hover:underline">Open doubt ↗</Link>}
                    </div>
                    <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[1fr_1.1fr]">
                        <section aria-label="Original doubt">
                            <p className="text-xs font-bold uppercase tracking-[0.12em] text-graphite">Original doubt</p>
                            {answer.doubt ? <>
                                <h3 className="mt-2 text-lg font-bold leading-snug">{answer.doubt.title}</h3>
                                <p className="mt-1 text-xs font-semibold text-pencil">{answer.doubt.course} <span className="text-graphite">·</span> {answer.doubt.topic}</p>
                                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-graphite">{answer.doubt.description}</p>
                            </> : <p className="mt-2 text-sm text-margin">The linked doubt could not be loaded.</p>}
                        </section>
                        <section aria-label="Submitted answer" className="rounded-xl bg-paper p-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-xs font-bold uppercase tracking-[0.12em] text-graphite">Helper explanation</p>
                                <p className="text-xs text-graphite">{answer.helper?.name || 'Helper'}{Number.isFinite(answer.helper?.helperProfile?.reputation) ? ` · ${answer.helper.helperProfile.reputation} reputation` : ''}</p>
                            </div>
                            <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{answer.content || answer.body}</p>
                            {answer.moderationHistory?.length > 0 && <details className="mt-3 text-xs text-graphite"><summary className="cursor-pointer font-semibold">Review history ({answer.moderationHistory.length})</summary><ul className="mt-2 space-y-1">{answer.moderationHistory.map((entry, index) => <li key={`${entry.action}-${index}`}>{entry.action} · {entry.moderator?.name || 'Moderator'} · {formatDateTime(entry.createdAt)}{entry.reason ? ` · ${entry.reason}` : ''}</li>)}</ul></details>}
                        </section>
                    </div>
                    {statusFilter === 'PENDING' && <div className="flex flex-col gap-3 border-t border-rule p-4 sm:p-5">
                        <label className="text-sm font-semibold" htmlFor={`reason-category-${answer._id}`}>Rejection reason</label>
                        <select id={`reason-category-${answer._id}`} className="field" value={categories[answer._id] || ''}
                            onChange={(event) => setCategories((current) => ({ ...current, [answer._id]: event.target.value }))}>
                            <option value="">Choose a reason</option>
                            <option value="INCORRECT">Incorrect</option>
                            <option value="INCOMPLETE">Incomplete</option>
                            <option value="OFF_TOPIC">Off-topic</option>
                            <option value="SPAM_INAPPROPRIATE">Spam or inappropriate content</option>
                            <option value="OTHER">Other</option>
                        </select>
                        <label className="text-sm font-semibold" htmlFor={`note-${answer._id}`}>{isCr ? 'Reason for rejection' : 'Written faculty feedback'} <span className="font-normal text-graphite">(required)</span></label>
                        <textarea id={`note-${answer._id}`} rows={2} maxLength={900} className="field resize-y" value={reasons[answer._id] || ''}
                            onChange={(event) => setReasons((current) => ({ ...current, [answer._id]: event.target.value }))}
                            placeholder={isCr ? 'Explain why this answer cannot be forwarded' : 'Explain what is correct or needs improvement'} />
                        {!isCr && <fieldset>
                            <legend className="text-sm font-semibold">Faculty rating <span className="font-normal text-graphite">(required)</span></legend>
                            <div className="mt-2 flex gap-1" role="radiogroup" aria-label="Faculty rating from 1 to 5 stars">
                                {[1, 2, 3, 4, 5].map((rating) => <button
                                    key={rating}
                                    type="button"
                                    role="radio"
                                    aria-checked={ratings[answer._id] === rating}
                                    aria-label={`${rating} ${rating === 1 ? 'star' : 'stars'}`}
                                    className={`rounded px-1 text-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-pencil ${rating <= (ratings[answer._id] || 0) ? 'text-verified' : 'text-graphite'}`}
                                    onClick={() => setRatings((current) => ({ ...current, [answer._id]: rating }))}
                                >★</button>)}
                            </div>
                        </fieldset>}
                        <div className="flex flex-wrap justify-end gap-2">
                            {answer.reviewAssignedTo && answer.reviewAssignedTo._id !== session?.user?.id ? <p className="mr-auto self-center text-sm text-graphite">Assigned to {answer.reviewAssignedTo.name}</p> : <>
                                {!answer.reviewAssignedTo && <button type="button" className="btn-quiet" onClick={() => assign(answer)} disabled={!!busy}>{busy === answer._id ? 'Assigning…' : 'Assign to me'}</button>}
                                {answer.reviewAssignedTo?._id === session?.user?.id && <button type="button" className="btn-quiet" onClick={() => release(answer)} disabled={!!busy}>{busy === answer._id ? 'Releasing…' : 'Release assignment'}</button>}
                                {isCr ? <>
                                    <button type="button" className="btn-quiet text-margin" onClick={() => review(answer, 'reject')} disabled={!!busy}>Reject</button>
                                    <button type="button" className="btn-quiet" onClick={() => markDuplicate(answer)} disabled={!!busy}>Mark duplicate</button>
                                    <button type="button" className="btn-primary" onClick={() => review(answer, 'forward')} disabled={!!busy}>Approve &amp; forward to faculty</button>
                                </> : <>
                                    <button type="button" className="btn-quiet text-margin" onClick={() => review(answer, 'reject')} disabled={!!busy}>Reject</button>
                                    <button type="button" className="btn-quiet" onClick={() => review(answer, 'needs-improvement')} disabled={!!busy}>Needs improvement</button>
                                    <button type="button" className="btn-primary" onClick={() => review(answer, 'verify')} disabled={!!busy}>Verify</button>
                                </>}
                            </>}
                        </div>
                    </div>
                    }
                    {statusFilter === 'REJECTED' && session?.user?.roles?.includes('faculty') && <div className="border-t border-rule p-4 sm:p-5"><label className="block text-sm font-semibold" htmlFor={`reconsider-${answer._id}`}>Faculty reconsideration note</label><textarea id={`reconsider-${answer._id}`} rows={2} maxLength={1000} className="field mt-2" value={reasons[answer._id] || ''} onChange={(event) => setReasons((current) => ({ ...current, [answer._id]: event.target.value }))} placeholder="Why should the helper revise and resubmit this answer?" /><button type="button" className="btn-primary mt-3" disabled={!!busy} onClick={() => review(answer, 'reconsider')}>Reopen for correction</button></div>}
                </article>
            ))}
            {!loading && pagination.pages > 1 && <div className="flex items-center justify-between"><button type="button" className="btn-quiet" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</button><span className="text-sm text-graphite">Page {page} of {pagination.pages} · {pagination.total} answers</span><button type="button" className="btn-quiet" disabled={page >= pagination.pages} onClick={() => setPage((current) => current + 1)}>Next</button></div>}
        </div>
    );
}
