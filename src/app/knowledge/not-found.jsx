import Link from 'next/link';

export default function KnowledgeNotFound() {
    return <main className="mx-auto flex min-h-[55vh] max-w-3xl items-center px-4 py-10"><section className="card w-full p-7 sm:p-10"><p className="text-xs font-bold uppercase tracking-[0.16em] text-pencil">Library / not found</p><h1 className="mt-3 text-3xl font-semibold tracking-tight">That explanation isn’t available.</h1><p className="mt-3 text-sm leading-6 text-graphite">It may have been archived or the link may be incomplete. Browse the current verified library instead.</p><Link href="/knowledge" className="btn-primary mt-6">Browse knowledge</Link></section></main>;
}
