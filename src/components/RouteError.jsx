'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function RouteError({ error, retry, area = 'this page' }) {
    useEffect(() => {
        console.error('UNSTUCK_PAGE_RENDER_FAILED', {
            area,
            name: error instanceof Error ? error.name : 'UnknownError',
            digest: error?.digest || 'unavailable',
        });
    }, [area, error]);

    return (
        <main className="mx-auto flex min-h-[58vh] w-full max-w-3xl items-center px-4 py-12 sm:px-6">
            <section className="card w-full overflow-hidden p-6 sm:p-9" role="alert">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-margin">A pause in the learning loop</p>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">We couldn’t load {area}.</h1>
                <p className="mt-3 max-w-xl text-sm leading-6 text-graphite">Your work is still in your class workspace. Retry the request, or return to your questions while the page recovers.</p>
                {error?.digest && <p className="mt-4 font-mono text-xs text-graphite">Reference: {error.digest}</p>}
                <div className="mt-6 flex flex-wrap gap-3">
                    <button type="button" className="btn-primary" onClick={() => retry()}>Try again</button>
                    <Link href="/doubts/mine" className="btn-quiet">Back to my doubts</Link>
                </div>
            </section>
        </main>
    );
}
