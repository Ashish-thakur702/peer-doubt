export default function Loading() {
    return (
        <main className="mx-auto min-h-[60vh] max-w-7xl px-4 py-10 sm:px-6 lg:px-8" aria-label="Loading unStuck">
            <div className="mb-8 max-w-2xl space-y-3"><div className="h-3 w-32 animate-pulse rounded bg-rule" /><div className="h-10 w-2/3 animate-pulse rounded bg-rule" /><div className="h-4 w-full max-w-xl animate-pulse rounded bg-rule" /></div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[1, 2, 3].map((item) => <div key={item} className="card h-48 animate-pulse" />)}</div>
        </main>
    );
}
