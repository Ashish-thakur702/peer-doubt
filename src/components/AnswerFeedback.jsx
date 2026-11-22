'use client';
import { fetchWithTimeout } from '@/lib/client-fetch';
import { useEffect, useState } from 'react';

export default function AnswerFeedback({ answerId }) {
    const [data, setData] = useState(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [loading, setLoading] = useState(true);
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        let active = true;
        async function load() {
            setLoading(true);
            setError('');
            try {
                const response = await fetchWithTimeout(`/api/answers/${answerId}/feedback`);
                const result = await response.json();
                if (!response.ok) throw new Error(result.msg || 'Could not load answer feedback.');
                if (active) setData(result);
            } catch (err) {
                if (active) setError(err.message || 'Could not load answer feedback.');
            } finally {
                if (active) setLoading(false);
            }
        }
        load();
        return () => { active = false; };
    }, [answerId, attempt]);

    async function vote(helpful) {
        setBusy(true); setError('');
        try {
            const response = await fetchWithTimeout(`/api/answers/${answerId}/feedback`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ helpful }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.msg || 'Could not save your feedback.');
            setData((current) => ({ ...current, ...result }));
        } catch (err) { setError(err.message); }
        finally { setBusy(false); }
    }

    return <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-rule pt-3" aria-label="Answer helpfulness">
        <span className="mr-1 text-xs font-semibold text-graphite">Was this answer helpful?</span>
        <button type="button" className={`btn-quiet min-h-8 px-2.5 text-xs ${data?.vote === true ? 'border-pencil text-pencil' : ''}`} disabled={!data?.canVote || busy || loading} aria-pressed={data?.vote === true} onClick={() => vote(true)}>Yes {data ? `(${data.helpful})` : ''}</button>
        <button type="button" className={`btn-quiet min-h-8 px-2.5 text-xs ${data?.vote === false ? 'border-pencil text-pencil' : ''}`} disabled={!data?.canVote || busy || loading} aria-pressed={data?.vote === false} onClick={() => vote(false)}>No {data ? `(${data.unhelpful})` : ''}</button>
        {loading && <span className="text-xs text-graphite">Loading feedback…</span>}
        {data?.canVote === false && <span className="text-xs text-graphite">Helpers cannot vote on their own answers.</span>}
        {error && <span role="alert" className="text-xs text-margin">{error}</span>}
        {error && !loading && <button type="button" className="text-xs font-semibold text-pencil underline" onClick={() => { setError(''); setLoading(true); setAttempt((value) => value + 1); }}>Try again</button>}
    </div>;
}
