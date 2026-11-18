import Link from 'next/link';

export const metadata = { title: 'Access denied' };

export default function AccessDeniedPage() {
    return <section className="mx-auto flex min-h-[65vh] max-w-xl items-center px-4 py-12">
        <div className="card w-full space-y-4 p-7 sm:p-9">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-margin">403 · Access denied</p>
            <h1 className="text-3xl font-bold tracking-tight">This area is restricted</h1>
            <p className="text-sm leading-6 text-graphite">Your current account does not have permission to open this page. If your access was recently changed, refresh after signing in again.</p>
            <div className="flex flex-wrap gap-3 pt-1">
                <Link className="btn-primary" href="/doubts/mine">Go to my doubts</Link>
                <Link className="btn-quiet" href="/login">Sign in with another account</Link>
            </div>
        </div>
    </section>;
}
