import Link from 'next/link';

export default function AuthShell({ title, hint, eyebrow = 'unStuck · Stuck at Question Three', children, footer }) {
    return (
        <div className="auth-shell-grid mx-auto w-full max-w-6xl">
            <section className="auth-story" aria-label="About unStuck">
                <div className="auth-story-orbit auth-story-orbit-one" aria-hidden="true" />
                <div className="auth-story-orbit auth-story-orbit-two" aria-hidden="true" />
                <div className="auth-story-content">
                    <Link href="/" className="auth-story-brand" aria-label="unStuck home">
                        <span className="auth-brand-mark" aria-hidden="true">u</span>
                        <span><span className="brand-wordmark-un">un</span><span className="brand-wordmark-stuck">Stuck</span></span>
                    </Link>

                    <p className="auth-story-eyebrow"><span />{eyebrow}</p>
                    <h2 className="auth-story-title">A better answer<br />starts with <em>your question.</em></h2>
                    <p className="auth-story-description">A shared space for students to ask, peers to explain, and the best class knowledge to stay easy to find.</p>

                    <div className="auth-learning-loop" aria-label="How unStuck works">
                        <div className="auth-loop-line" aria-hidden="true" />
                        <div className="auth-loop-step"><span className="auth-loop-index">01</span><span><strong>Ask</strong><small>Put the stuck part into words</small></span><span className="auth-loop-status">OPEN</span></div>
                        <div className="auth-loop-step"><span className="auth-loop-index">02</span><span><strong>Explain</strong><small>Learn with a peer&apos;s reasoning</small></span><span className="auth-loop-status">PEER</span></div>
                        <div className="auth-loop-step"><span className="auth-loop-index">03</span><span><strong>Keep</strong><small>Save what helps the whole class</small></span><span className="auth-loop-status auth-loop-status-final">SAVED</span></div>
                    </div>
                    <p className="auth-story-footnote"><span aria-hidden="true">✳</span> Learning gets better when nobody has to stay stuck alone.</p>
                </div>
                <div className="auth-story-coordinate" aria-hidden="true">CAMPUS KNOWLEDGE / 01—03</div>
            </section>

            <section className="auth-panel">
                <div className="auth-panel-topline">
                    <span className="auth-panel-label">CLASS KNOWLEDGE, KEPT IN MOTION</span>
                    <span className="auth-panel-mark" aria-hidden="true">↗</span>
                </div>
                <div className="auth-panel-heading">
                    <h1>{title}</h1>
                    <p>{hint}</p>
                </div>
                {children}
                <p className="auth-panel-footer">{footer}</p>
                <p className="auth-panel-privacy"><span aria-hidden="true">◈</span> Your learning space, connected to your class.</p>
            </section>
        </div>
    );
}
