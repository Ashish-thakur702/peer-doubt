import Link from 'next/link';
import { Suspense } from 'react';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/db';
import Doubt from '@/models/Doubt';
import DoubtCard from '@/components/DoubtCard';
import { getPrimaryRole, roleLabel } from '@/lib/auth/roles.mjs';

async function MyDoubtsContent() {
    const session = await getServerSession(authOptions);
    await connectDB();
    const doubts = JSON.parse(
        JSON.stringify(await Doubt.find({ author: session.user.id }).sort({ createdAt: -1 }).lean())
    );
    const firstName = session?.user?.name?.trim().split(/\s+/)[0] || 'there';
    const roles = session?.user?.roles || (session?.user?.role ? [session.user.role] : []);
    const primaryRole = getPrimaryRole(roles);
    const roleWorkspace = {
        student: { title: 'Help a classmate', description: 'Choose the topics you know and offer a peer explanation when you are ready.', href: '/helper/profile', action: 'Set up your helper profile' },
        helper: { title: 'Make an answer matter', description: 'Pick an open doubt and walk a classmate through the idea in your own words.', href: '/helper', action: 'Open helper workspace' },
        cr: { title: 'Keep answers trustworthy', description: 'Review peer explanations and add verified answers to shared class knowledge.', href: '/moderation', action: 'Open moderation desk' },
        faculty: { title: 'Keep answers trustworthy', description: 'Guide reviews, resolve reports, and build a dependable course library.', href: '/moderation', action: 'Open moderation desk' },
        admin: { title: 'Shape who can help', description: 'Manage role access and course scopes for your learning community.', href: '/admin/users', action: 'Manage user access' },
    }[primaryRole];
    const statusCount = (statuses) => doubts.filter((doubt) => statuses.includes(doubt.status)).length;
    const counts = [
        { label: 'Questions asked', value: doubts.length, caption: 'Your class questions', tone: 'neutral', icon: '✳' },
        { label: 'Waiting for a helper', value: statusCount(['OPEN']), caption: 'Ready for someone to pick up', tone: 'warm', icon: '◌' },
        { label: 'In progress', value: statusCount(['CLAIMED', 'ANSWERED']), caption: 'A response is taking shape', tone: 'lime', icon: '↗' },
        { label: 'Verified', value: statusCount(['VERIFIED']), caption: 'Added to class knowledge', tone: 'green', icon: '✓' },
    ];

    return (
        <div className="student-dashboard space-y-7">
            <header className="dashboard-welcome">
                <div className="dashboard-welcome-copy"><p className="dashboard-eyebrow"><span className="dashboard-eyebrow-dot"/>YOUR CLASS WORKSPACE <span className="dashboard-role-pill">{roleLabel(primaryRole)}</span></p><h1>Good to see you, <em>{firstName}.</em></h1><p>Pick up where you left off, or ask your class the question that is holding you back.</p></div>
                <Link href="/doubts/new" className="btn-primary dashboard-cta"><span aria-hidden="true">＋</span> Ask a doubt <span aria-hidden="true">→</span></Link>
                <div className="dashboard-welcome-orbit dashboard-orbit-one" aria-hidden="true"/><div className="dashboard-welcome-orbit dashboard-orbit-two" aria-hidden="true"/>
            </header>
            <section aria-label="Your doubt activity" className="dashboard-metrics">
                {counts.map((metric) => <article key={metric.label} className={`dashboard-metric metric-${metric.tone}`}>
                    <div className="dashboard-metric-top"><span>{metric.label}</span><span className="dashboard-metric-icon" aria-hidden="true">{metric.icon}</span></div>
                    <p className="dashboard-metric-value">{metric.value}</p><p className="dashboard-metric-caption">{metric.caption}</p>
                </article>)}
            </section>
            <section className="dashboard-content-grid">
                <div className="dashboard-list-panel">
                    <div className="dashboard-section-heading"><div><p className="dashboard-kicker">YOUR QUESTIONS</p><h2>Recent doubts</h2><p>Keep track of every explanation and its review status.</p></div><Link href="/doubts/new" className="dashboard-text-link">Ask a question <span aria-hidden="true">↗</span></Link></div>
            {doubts.length === 0 && <section className="card empty-doubt-card relative isolate overflow-hidden border-slate-900/5 px-5 py-16 text-center shadow-[0_1px_3px_rgba(0,0,0,0.02),0_12px_32px_-8px_rgba(15,23,42,0.06)] sm:px-8">
                <div className="empty-doubt-glow" aria-hidden="true" />
                <div className="relative">
                    <span className="empty-doubt-icon mx-auto flex h-14 w-14 items-center justify-center rounded-2xl" aria-hidden="true">
                        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                            <path d="M5.25 7.75A3.5 3.5 0 0 1 8.75 4.25h10.5a3.5 3.5 0 0 1 3.5 3.5v7a3.5 3.5 0 0 1-3.5 3.5h-6.1l-4.9 4v-4H8.75a3.5 3.5 0 0 1-3.5-3.5z" fill="currentColor" opacity=".18" />
                            <path d="M14 9.1a2.35 2.35 0 1 1 2.18 3.2c-.94.2-1.68.88-1.68 1.85v.3M14.5 17.65h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </span>
                    <h2 className="mt-5 font-bold tracking-tight">Start with a question</h2>
                    <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-graphite">Your doubts and their progress will be collected here.</p>
                    <Link href="/doubts/new" className="btn-primary mt-6">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
                        Ask your first doubt
                    </Link>
                </div>
            </section>}
                    {doubts.length > 0 && <ul className="dashboard-doubt-list">{doubts.map((d) => <DoubtCard key={d._id} doubt={d} />)}</ul>}
                </div>
                <aside className="dashboard-side-rail">
                    <section className="dashboard-guide-card"><span className="dashboard-guide-icon" aria-hidden="true">✦</span><p className="dashboard-kicker">A BETTER QUESTION</p><h2>Share where you got stuck.</h2><p>Add what you tried and the step that stopped making sense. It helps classmates give you an explanation you can reuse.</p><Link href="/doubts/new" className="dashboard-guide-link">Write a doubt <span aria-hidden="true">→</span></Link></section>
                    <section className="dashboard-progress-card"><div className="dashboard-section-heading compact"><div><p className="dashboard-kicker">YOUR LEARNING LOOP</p><h2>From question to knowledge</h2></div></div><div className="learning-loop-list"><div className="learning-loop-step is-current"><span>01</span><div><strong>Ask clearly</strong><small>Describe the part you are working through.</small></div></div><div className="learning-loop-step"><span>02</span><div><strong>Learn from a peer</strong><small>A helper explains it in their own words.</small></div></div><div className="learning-loop-step"><span>03</span><div><strong>Keep the answer</strong><small>Verified explanations join the library.</small></div></div></div><Link href="/knowledge" className="dashboard-text-link">Browse class knowledge <span aria-hidden="true">↗</span></Link></section>
                    <section className="dashboard-role-card"><p className="dashboard-kicker">YOUR {roleLabel(primaryRole).toUpperCase()} WORKSPACE</p><h2>{roleWorkspace.title}</h2><p>{roleWorkspace.description}</p><Link href={roleWorkspace.href} className="dashboard-guide-link">{roleWorkspace.action} <span aria-hidden="true">→</span></Link></section>
                </aside>
            </section>
        </div>
    );
}

export default function MyDoubtsPage() {
    return <Suspense fallback={<div className="card h-48 animate-pulse" aria-label="Loading your doubts" />}><MyDoubtsContent /></Suspense>;
}
