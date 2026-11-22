'use client';

import './globals.css';
import { useEffect } from 'react';

export default function GlobalError({ error, retry }) {
    useEffect(() => {
        console.error('UNSTUCK_ROOT_RENDER_FAILED', {
            name: error instanceof Error ? error.name : 'UnknownError',
            digest: error?.digest || 'unavailable',
        });
    }, [error]);

    return (
        <html lang="en" data-theme="dark">
            <head><title>unStuck · Temporary interruption</title></head>
            <body className="font-sans antialiased">
                <main className="flex min-h-screen items-center justify-center bg-paper px-5 py-12 text-ink">
                    <section className="card w-full max-w-2xl p-7 sm:p-10" role="alert">
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-margin">unStuck / recovery</p>
                        <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">A page needs another moment.</h1>
                        <p className="mt-3 text-sm leading-6 text-graphite">The app hit an unexpected error. Retry to reload your class workspace.</p>
                        <button type="button" className="btn-primary mt-6" onClick={() => retry()}>Reload workspace</button>
                    </section>
                </main>
            </body>
        </html>
    );
}
