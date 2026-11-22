import Link from 'next/link';

export default function NotFound() {
    return (
        <main className="mx-auto flex min-h-[58vh] w-full max-w-3xl items-center px-4 py-12 sm:px-6">
            <section className="card w-full p-7 sm:p-10">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-pencil">404 / off the page</p>
                <h1 className="mt-3 text-4xl font-semibold tracking-tight">We couldn’t find that page.</h1>
                <p className="mt-3 max-w-xl text-sm leading-6 text-graphite">The link may be incomplete, or the page may have moved. Head back to your class questions or explore verified explanations.</p>
                <div className="mt-6 flex flex-wrap gap-3"><Link href="/doubts/mine" className="btn-primary">My doubts</Link><Link href="/knowledge" className="btn-quiet">Knowledge library</Link></div>
            </section>
        </main>
    );
}
