import Link from 'next/link';
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import StatusTimeline from '@/components/StatusTimeLine';

const FLOW = [
    ['01', 'Ask clearly', 'Give the question a course, a topic, and enough context for someone to meet you where you are.'],
    ['02', 'Find the right mind', 'Helpers see questions that match what they know and can claim one to work through.'],
    ['03', 'Keep what works', 'Good explanations are reviewed and become a searchable reference for the whole class.'],
];

async function LandingContent() {
    const session = await getServerSession(authOptions);
    if (session) redirect('/doubts/mine');

    return (
        <div className="overflow-hidden">
            <section className="landing-hero border-b border-rule">
                <div className="mx-auto grid max-w-7xl items-end gap-16 px-5 pb-20 pt-16 sm:px-8 lg:grid-cols-[1.05fr_.95fr] lg:px-12 lg:pb-28 lg:pt-24">
                    <div>
                        <p className="mb-6 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.22em] text-pencil"><span className="h-px w-8 bg-pencil" />A better place to get unstuck</p>
                        <h1 className="max-w-4xl text-[clamp(3.4rem,8vw,7.4rem)] font-semibold leading-[0.9] tracking-[-0.07em]">Questions deserve<br /><span className="headline-accent">better answers.</span></h1>
                        <p className="mt-8 max-w-xl text-lg leading-8 text-graphite">unStuck is the learning loop your class has been missing: ask a real question, get a thoughtful explanation, and leave a trail for the next person.</p>
                        <div className="mt-9 flex flex-wrap items-center gap-3">
                            <Link href="/register" className="btn-primary px-5 py-3">Ask your first doubt <span aria-hidden="true">↗</span></Link>
                            <Link href="#how-it-works" className="btn-quiet px-5 py-3">See how it works</Link>
                        </div>
                        <p className="mt-5 text-xs font-medium uppercase tracking-[0.12em] text-graphite">Built for students · helpers · course staff</p>
                    </div>

                    <div className="relative lg:pb-8">
                        <div className="hero-card relative overflow-hidden rounded-xl border border-rule bg-sheet p-5 sm:p-7">
                            <div className="mb-8 flex items-center justify-between border-b border-rule pb-4"><span className="text-xs font-bold uppercase tracking-[0.18em] text-graphite">Live question</span><span className="flex items-center gap-2 text-xs font-semibold text-verified"><span className="h-2 w-2 rounded-full bg-verified" />Verified</span></div>
                            <StatusTimeline status="VERIFIED" />
                            <p className="mt-8 text-xs font-bold uppercase tracking-[0.13em] text-pencil">Graph algorithms · DAA</p>
                            <h2 className="mt-3 max-w-md text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">When does Dijkstra&rsquo;s algorithm fail?</h2>
                            <p className="mt-4 max-w-md font-serif text-base leading-7 text-graphite">I understand the steps, but I can&rsquo;t see why one negative edge changes everything.</p>
                            <div className="mt-7 border-l-2 border-pencil pl-4"><p className="text-sm font-semibold">A useful answer is more than a solution.</p><p className="mt-1 text-sm leading-6 text-graphite">It shows the reasoning you can reuse next time.</p></div>
                            <div className="mt-8 flex items-center justify-between border-t border-rule pt-4 text-xs text-graphite"><span>Answered by Riya · reviewed by course staff</span><span>2:14 a.m.</span></div>
                        </div>
                        <div className="hero-badge absolute -bottom-4 -left-3 hidden px-3 py-2 text-xs font-bold sm:block">Saved to class knowledge ↗</div>
                    </div>
                </div>
            </section>

            <section id="how-it-works" className="border-b border-rule bg-sheet">
                <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-12">
                    <div className="grid gap-12 lg:grid-cols-[.7fr_1.3fr]"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-pencil">A simple loop</p><h2 className="mt-4 max-w-sm text-4xl font-semibold leading-[0.96] tracking-[-0.04em]">Turn being stuck into shared momentum.</h2></div><div className="divide-y divide-rule border-y border-rule">{FLOW.map(([number, title, text]) => <div key={number} className="grid gap-3 py-6 sm:grid-cols-[4rem_1fr_1.15fr] sm:items-start"><span className="font-mono text-sm font-bold text-pencil">{number}</span><h3 className="text-lg font-semibold">{title}</h3><p className="max-w-md text-sm leading-6 text-graphite">{text}</p></div>)}</div></div>
                </div>
            </section>

            <section id="library" className="border-b border-rule">
                <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[1fr_1fr] lg:px-12 lg:py-24">
                    <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-pencil">Designed for the whole class</p><h2 className="mt-4 max-w-lg text-4xl font-semibold leading-[0.98] tracking-[-0.04em] sm:text-5xl">The best explanations shouldn&rsquo;t disappear in a chat.</h2><p className="mt-6 max-w-md leading-7 text-graphite">Students get a calm place to ask. Helpers get focused questions they can actually answer. CRs and faculty keep the shared library trustworthy.</p><Link href="/register" className="mt-7 inline-flex font-bold text-pencil hover:underline">Join your class on unStuck <span className="ml-2">↗</span></Link></div>
                    <div className="grid gap-px border border-rule bg-rule sm:grid-cols-2"><div className="bg-sheet p-6"><p className="font-mono text-xs text-pencil">01</p><h3 className="mt-16 text-xl font-semibold">Students</h3><p className="mt-3 text-sm leading-6 text-graphite">Ask without searching a group chat. Follow the question from open to verified.</p></div><div className="bg-sheet p-6"><p className="font-mono text-xs text-pencil">02</p><h3 className="mt-16 text-xl font-semibold">Helpers</h3><p className="mt-3 text-sm leading-6 text-graphite">Choose the topics you know and explain them in your own words.</p></div><div className="bg-sheet p-6 sm:col-span-2"><p className="font-mono text-xs text-pencil">03</p><h3 className="mt-10 text-xl font-semibold">Course staff</h3><p className="mt-3 max-w-md text-sm leading-6 text-graphite">Review the answer, guide a revision, and decide what earns a permanent place in the library.</p></div></div>
                </div>
            </section>

            <section className="bg-pencil text-[#111214]"><div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 px-5 py-16 sm:px-8 lg:flex-row lg:items-end lg:px-12"><div><p className="text-xs font-bold uppercase tracking-[0.2em] opacity-70">Your next question is welcome here</p><h2 className="mt-4 max-w-2xl text-4xl font-semibold leading-[0.95] tracking-[-0.05em] sm:text-6xl">Make the stuck part useful.</h2></div><div><p className="max-w-xs text-sm leading-6 opacity-75">Create an account with your college email and bring your first doubt to the class.</p><div className="mt-5 flex flex-wrap gap-3"><Link href="/register" className="btn bg-[#111214] text-[#f2f0ea]">Create account</Link><Link href="/login" className="btn-quiet border-[#111214]/30 text-[#111214]">Log in</Link></div></div></div></section>
            <footer className="border-t border-rule bg-sheet"><div className="mx-auto max-w-7xl px-5 py-6 text-xs font-semibold uppercase tracking-[0.15em] text-graphite sm:px-8 lg:px-12">unStuck / class knowledge, kept in motion</div></footer>
        </div>
    );
}

export default function Landing() {
    return <Suspense fallback={<div className="min-h-[60vh] animate-pulse bg-sheet" aria-label="Loading unStuck" />}><LandingContent /></Suspense>;
}
