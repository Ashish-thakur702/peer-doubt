'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { COURSES } from '@/lib/courses';

const ROLE_OPTIONS = [
    { value: 'student', label: 'Student' },
    { value: 'cr', label: 'Course representative' },
    { value: 'faculty', label: 'Faculty' },
    { value: 'admin', label: 'Admin' },
];

export default function UserManagement() {
    const [items, setItems] = useState([]);
    const [drafts, setDrafts] = useState({});
    const [q, setQ] = useState('');
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
    const [viewerId, setViewerId] = useState('');
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState('');
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');

    const load = useCallback(async () => {
        setLoading(true); setError('');
        try {
            const params = new URLSearchParams({ page: String(page), limit: '20' });
            if (q.trim()) params.set('q', q.trim());
            const response = await fetch(`/api/admin/users?${params}`);
            const data = await response.json();
            if (!response.ok) throw new Error(data.msg || 'Could not load users.');
            setItems(data.items || []); setPagination(data.pagination); setViewerId(data.viewerId);
            setDrafts(Object.fromEntries((data.items || []).map((user) => [user._id, {
                role: user.role && user.role !== 'helper' ? user.role : (user.roles || []).find((role) => role !== 'helper') || 'student',
                assignedCourses: user.assignedCourses || [],
                department: user.department || '',
                isSuspended: user.status === 'suspended' || user.isSuspended || false,
                note: '',
            }])));
        } catch (err) { setError(err.message); }
        finally { setLoading(false); }
    }, [q, page]);

    useEffect(() => { const timer = setTimeout(load, 250); return () => clearTimeout(timer); }, [load]);

    function update(userId, key, value) {
        setDrafts((current) => ({ ...current, [userId]: { ...current[userId], [key]: value } }));
    }

    function toggleCourse(userId, selected, course) {
        update(userId, 'assignedCourses', selected
            ? [...new Set([...selected, course])]
            : selected.filter((item) => item !== course));
    }

    async function save(user) {
        const draft = drafts[user._id];
        const summary = [
            `Role: ${ROLE_OPTIONS.find((option) => option.value === draft.role)?.label || draft.role}`,
            draft.role === 'cr' || draft.role === 'faculty' ? `Courses: ${draft.assignedCourses.join(', ') || 'none'}` : '',
            draft.role === 'faculty' ? `Department: ${draft.department || 'none'}` : '',
            `Account: ${draft.isSuspended ? 'suspended' : 'active'}`,
        ].filter(Boolean).join('\n');
        if (!window.confirm(`Apply these access changes to ${user.name}?\n\n${summary}`)) return;
        setBusy(user._id); setError(''); setMessage('');
        try {
            const response = await fetch('/api/admin/users', {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user._id, ...draft }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.msg || 'Could not save account changes.');
            setMessage(`Updated access for ${user.name}.`);
            await load();
        } catch (err) { setError(err.message); }
        finally { setBusy(''); }
    }

    return <div className="space-y-5">
        <header><p className="text-xs font-bold uppercase tracking-[0.16em] text-pencil">Authorized administration</p><h1 className="mt-1 text-3xl font-bold">User access</h1><p className="mt-2 text-sm text-graphite">Provision CR, faculty, and admin access, configure course scopes, and suspend accounts. Helper availability is managed by each student. Every change is recorded.</p><Link className="mt-3 inline-block text-sm font-semibold text-pencil hover:underline" href="/admin/audit">View access audit history</Link></header>
        <label className="block max-w-xl text-sm font-semibold">Find a user<input className="field mt-1" type="search" maxLength={80} value={q} onChange={(event) => { setQ(event.target.value); setPage(1); }} placeholder="Name or email" /></label>
        {message && <p className="rounded-lg bg-verified/10 p-3 text-sm text-verified" role="status">{message}</p>}
        {error && <p className="rounded-lg bg-margin/10 p-3 text-sm text-margin" role="alert">{error}</p>}
        {loading && <div className="card h-36 animate-pulse" aria-label="Loading users" />}
        {!loading && !error && !items.length && <div className="card p-8 text-sm text-graphite">No users found.</div>}
        {!loading && items.map((user) => {
            const draft = drafts[user._id] || { role: user.role && user.role !== 'helper' ? user.role : 'student', assignedCourses: user.assignedCourses || [], department: user.department || '', isSuspended: user.isSuspended, note: '' };
            const disabled = user._id === viewerId;
            const privileged = ['cr', 'faculty'].includes(draft.role);
            return <article key={user._id} className="card space-y-4 p-4 sm:p-5">
                <header className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-bold">{user.name}</h2><p className="text-sm text-graphite">{user.email} · Joined {new Date(user.createdAt).toLocaleDateString()}</p><p className="mt-2 text-xs text-graphite">Helper opt-in: {user.isHelper ? `Available ${user.availability ? 'now' : 'when enabled'} in ${(user.courses || []).join(', ')}` : 'Not opted in'}</p><p className="mt-1 text-xs text-graphite">Activity: {user.activity.doubts} doubts, {user.activity.answers} answers, {user.activity.reports} reports, {user.activity.moderationActions} moderation actions</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${draft.isSuspended ? 'bg-margin/10 text-margin' : 'bg-verified/10 text-verified'}`}>{draft.isSuspended ? 'Suspended' : 'Active'}</span></header>
                <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-sm font-semibold">Account role<select className="field mt-1" value={draft.role} disabled={disabled || busy === user._id} onChange={(event) => update(user._id, 'role', event.target.value)}>{ROLE_OPTIONS.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}</select></label>
                    {draft.role === 'faculty' && <label className="block text-sm font-semibold">Department<input className="field mt-1" maxLength={120} value={draft.department} disabled={disabled || busy === user._id} onChange={(event) => update(user._id, 'department', event.target.value)} placeholder="e.g. Computer Science" /></label>}
                </div>
                {privileged && <fieldset disabled={disabled || busy === user._id} className="rounded-xl border border-rule p-3">
                    <legend className="px-1 text-xs font-bold uppercase tracking-wide text-graphite">{draft.role === 'cr' ? 'Assigned courses' : 'Faculty course scope'}</legend>
                    <div className="grid gap-2 sm:grid-cols-2">{Object.keys(COURSES).map((course) => <label key={course} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.assignedCourses.includes(course)} onChange={(event) => toggleCourse(user._id, event.target.checked, course)} />{course}</label>)}</div>
                </fieldset>}
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.isSuspended} disabled={disabled || busy === user._id} onChange={(event) => update(user._id, 'isSuspended', event.target.checked)} />Suspend sign-in and API access</label>
                {!disabled && <><label className="block text-xs font-semibold text-graphite">Audit note<textarea className="field mt-1" minLength={3} maxLength={1000} value={draft.note} onChange={(event) => update(user._id, 'note', event.target.value)} placeholder="Why is this access change needed?" /></label><button type="button" className="btn-primary" disabled={busy === user._id || draft.note.trim().length < 3 || (draft.role === 'cr' && !draft.assignedCourses.length) || (draft.role === 'faculty' && (!draft.department.trim() || !draft.assignedCourses.length))} onClick={() => save(user)}>{busy === user._id ? 'Saving…' : 'Review and save changes'}</button></>}
            </article>;
        })}
        {!loading && pagination.pages > 1 && <div className="flex items-center justify-between"><button type="button" className="btn-quiet" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</button><span className="text-sm text-graphite">Page {page} of {pagination.pages} · {pagination.total} users</span><button type="button" className="btn-quiet" disabled={page >= pagination.pages} onClick={() => setPage((current) => current + 1)}>Next</button></div>}
    </div>;
}
