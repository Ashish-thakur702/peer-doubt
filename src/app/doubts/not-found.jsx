import Link from 'next/link';

export default function DoubtNotFound() {
    return <main className="mx-auto flex min-h-[55vh] max-w-3xl items-center px-4 py-10"><section className="card w-full p-7 sm:p-10"><p className="text-xs font-bold uppercase tracking-[0.16em] text-pencil">Question / not found</p><h1 className="mt-3 text-3xl font-semibold tracking-tight">This doubt is no longer here.</h1><p className="mt-3 text-sm leading-6 text-graphite">Check the link or return to your questions to continue learning.</p><Link href="/doubts/mine" className="btn-primary mt-6">Back to my doubts</Link></section></main>;
}
