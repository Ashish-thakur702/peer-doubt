'use client';
import { fetchWithTimeout } from '@/lib/client-fetch';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import KnowledgeSaveButton from '@/components/knowledge/KnowledgeSaveButton';
import StatusBadge from '@/components/StatusBadge';

export default function SavedKnowledge() {
    const [items, setItems] = useState([]);
    const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        setLoading(true); setError('');
        try {
            const response = await fetchWithTimeout(`/api/knowledge/bookmarks?page=${page}&limit=24`);
            const data = await response.json();
            if (!response.ok) throw new Error(data.msg || 'Could not load saved knowledge.');
            setItems(data.items || []); setPagination(data.pagination || { page, pages: 1, total: 0 });
        } catch (err) { setError(err.message); }
        finally { setLoading(false); }
    }, [page]);

    useEffect(() => { const timer = setTimeout(load, 0); return () => clearTimeout(timer); }, [load]);

    return <div className="mx-auto max-w-7xl space-y-5 px-4 py-8 sm:px-6 lg:px-8">
        <header><p className="text-xs font-bold uppercase tracking-[0.16em] text-pencil">Personal study list</p><h1 className="mt-1 text-3xl font-bold">Saved knowledge</h1><p className="mt-2 text-sm text-graphite">Your bookmarks are private to your account.</p></header>
        {error && <p className="card p-4 text-sm text-margin" role="alert">{error}<button type="button" className="ml-2 font-semibold underline" onClick={load}>Retry</button></p>}
        {loading && <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Loading saved knowledge">{[1, 2, 3].map((item) => <div key={item} className="card h-48 animate-pulse" />)}</div>}
        {!loading && !error && !items.length && <div className="card p-10 text-center"><h2 className="font-bold">No saved entries yet</h2><p className="mt-2 text-sm text-graphite">Save verified explanations from the Knowledge Library to find them here.</p><Link className="mt-4 inline-block font-semibold text-pencil hover:underline" href="/knowledge">Browse knowledge</Link></div>}
        {!loading && items.length > 0 && <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{items.map((entry) => <article key={entry._id} className="card flex flex-col gap-3 p-5">
            <div className="flex items-center justify-between"><StatusBadge status="VERIFIED" /><KnowledgeSaveButton id={entry._id} saved onChange={(saved) => { if (!saved) setItems((current) => current.filter((item) => item._id !== entry._id)); }} /></div>
            <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-bold text-pencil">{entry.course} / {entry.topic}</p><p className="text-xs text-graphite">{entry.ratingCount > 0 ? <><span aria-hidden="true">&#9733;</span> {Number(entry.ratingAverage || 0).toFixed(1)} <span aria-hidden="true">&middot;</span> {entry.ratingCount} {entry.ratingCount === 1 ? 'rating' : 'ratings'}</> : 'No ratings yet'}</p></div>
            <h2 className="text-lg font-bold">{entry.title}</h2>
            <p className="line-clamp-3 text-sm leading-6 text-graphite">{entry.answerContent}</p>
            <p className="border-t border-rule pt-3 text-xs text-graphite">Answered by <span className="font-semibold text-ink">{entry.helper?.name || 'Peer helper'}</span> <span aria-hidden="true">&middot;</span> Verified by <span className="font-semibold text-ink">{entry.verifiedBy?.name || 'Moderator'}</span></p>
            <Link href={`/knowledge/${entry._id}`} className="mt-auto text-sm font-semibold text-pencil hover:underline">Read explanation</Link>
        </article>)}</div>}
        {!loading && pagination.pages > 1 && <div className="flex items-center justify-between"><button type="button" className="btn-quiet" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button><span className="text-sm text-graphite">Page {page} of {pagination.pages}</span><button type="button" className="btn-quiet" disabled={page >= pagination.pages} onClick={() => setPage((value) => value + 1)}>Next</button></div>}
    </div>;
}
