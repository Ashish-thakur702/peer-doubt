'use client';
import { fetchWithTimeout } from '@/lib/client-fetch';
import { useEffect, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { withTimeout } from '@/lib/client-fetch';
import AuthShell from '@/components/AuthShell';
import { authServiceMessage } from '@/lib/auth/client-messages';

const ROLE_OPTIONS = [
    { value: 'student', title: 'Student / Student helper', description: 'Ask questions, help peers, and save useful answers.', icon: 'student' },
    { value: 'academic', title: 'CR / Faculty', description: 'Guide course discussions and review explanations.', icon: 'academic' },
    { value: 'admin', title: 'Administrator', description: 'Manage accounts and platform access.', icon: 'admin' },
];

function RoleIcon({ name }) {
    const common = {
        width: 21,
        height: 21,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.7,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': true,
    };

    const paths = {
        student: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z" /><path d="M4 5.5v16M8 7h8M8 11h8" /></>,
        academic: <><path d="m3 10 9-5 9 5-9 5z" /><path d="M6 12.5v4.2c3.7 2.2 8.3 2.2 12 0v-4.2M21 10v6" /><path d="M9 20h6" /></>,
        admin: <><path d="M12 3 19 6v5c0 4.7-2.9 8-7 10-4.1-2-7-5.3-7-10V6z" /><path d="m9 12 2 2 4-4" /></>,
    };

    return <svg {...common}>{paths[name]}</svg>;
}

export default function Login() {
    const router = useRouter();
    const [form, setForm] = useState({ email: '', password: '', loginAs: 'student' });
    const [error, setError] = useState('');
    const [serviceNotice, setServiceNotice] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        let active = true;
        fetchWithTimeout('/api/auth/health', { cache: 'no-store' })
            .then(async (response) => {
                const status = await response.json().catch(() => ({}));
                if (active && !response.ok) setServiceNotice(authServiceMessage(status.issue));
            })
            .catch(() => {
                if (active) setServiceNotice(authServiceMessage('service_unreachable'));
            });
        return () => { active = false; };
    }, []);

    async function diagnoseService() {
        try {
            const response = await fetchWithTimeout('/api/auth/health', { cache: 'no-store' });
            const status = await response.json().catch(() => ({}));
            return response.ok ? '' : authServiceMessage(status.issue);
        } catch {
            return authServiceMessage('service_unreachable');
        }
    }

    async function onSubmit(event) {
        event.preventDefault();
        setError('');
        setLoading(true);
        try {
            const result = await withTimeout(signIn('credentials', { ...form, redirect: false }));
            if (!result?.ok || result?.error) {
                const issue = await diagnoseService();
                setServiceNotice(issue);
                if (issue) return;
                if (result?.error === 'CredentialsSignin') {
                    setError('That email, password, or account type does not match. Check your details and try again.');
                } else {
                    setError('Sign-in could not be completed. Try again in a moment.');
                }
                return;
            }

            setServiceNotice('');
            const callbackUrl = new URLSearchParams(window.location.search).get('callbackUrl');
            const defaultDestination = form.loginAs === 'admin'
                ? '/admin/users'
                : form.loginAs === 'academic'
                    ? '/moderation'
                    : '/doubts/mine';
            const nextUrl = callbackUrl?.startsWith('/') && !callbackUrl.startsWith('//') ? callbackUrl : defaultDestination;
            router.push(nextUrl);
            router.refresh();
        } catch {
            const issue = await diagnoseService();
            setServiceNotice(issue);
            setError(issue ? '' : 'Could not reach the sign-in service. Check your connection and try again.');
        } finally {
            setLoading(false);
        }
    }

    const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

    return (
        <AuthShell
            title="Welcome back"
            hint="Pick up where your doubts left off. Your class knowledge is right where you left it."
            eyebrow="Return to your class"
            footer={<>New to unStuck? <Link href="/register" className="font-semibold text-pencil underline-offset-4 hover:underline">Create an account</Link></>}
        >
            <form onSubmit={onSubmit} className="auth-form space-y-4">
                {serviceNotice && <p role="status" className="auth-service-notice">{serviceNotice}</p>}
                {error && <p role="alert" className="auth-error-notice">{error}</p>}

                <fieldset className="min-w-0 border-0 p-0">
                    <legend className="mb-2.5 block text-sm font-semibold">Continue as</legend>
                    <div className="role-card-group">
                        {ROLE_OPTIONS.map((role) => {
                            const selected = form.loginAs === role.value;
                            return (
                                <label key={role.value} className={`role-card${selected ? ' role-card-selected' : ''}`}>
                                    <input
                                        className="role-card-radio"
                                        type="radio"
                                        name="loginAs"
                                        value={role.value}
                                        checked={selected}
                                        onChange={set('loginAs')}
                                    />
                                    <span className="role-card-icon"><RoleIcon name={role.icon} /></span>
                                    <span className="role-card-copy">
                                        <span className="role-card-title">{role.title}</span>
                                        <span className="role-card-description">{role.description}</span>
                                    </span>
                                    <span className="role-card-indicator" aria-hidden="true">{selected ? '✓' : ''}</span>
                                </label>
                            );
                        })}
                    </div>
                    <p className="mt-2 text-xs leading-5 text-graphite">Helpers use their student or faculty account. Course staff access is assigned by an administrator.</p>
                </fieldset>

                <div>
                    <label htmlFor="email" className="mb-1.5 block text-sm font-semibold">Account email</label>
                    <input
                        id="email"
                        name="email"
                        type="email"
                        className="field"
                        autoComplete="username"
                        autoCapitalize="none"
                        spellCheck="false"
                        value={form.email}
                        onChange={set('email')}
                        required
                    />
                </div>

                <div>
                    <label htmlFor="password" className="mb-1.5 block text-sm font-semibold">Password</label>
                    <div className="auth-password-wrap">
                        <input
                            id="password"
                            name="password"
                            type={showPassword ? 'text' : 'password'}
                            className="field"
                            autoComplete="current-password"
                            value={form.password}
                            onChange={set('password')}
                            required
                        />
                        <button
                            type="button"
                            className="auth-password-toggle"
                            onClick={() => setShowPassword((visible) => !visible)}
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                            {showPassword ? 'Hide' : 'Show'}
                        </button>
                    </div>
                </div>

                <button className="btn-primary auth-submit w-full" disabled={loading}>
                    {loading ? <><span className="auth-spinner" aria-hidden="true" />Signing you in…</> : <>Log in <span aria-hidden="true">→</span></>}
                </button>
                <p className="auth-footnote">Your account and learning history are stored with your class workspace.</p>
            </form>
        </AuthShell>
    );
}
