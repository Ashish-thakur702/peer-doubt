'use client';
import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AuthShell from '@/components/AuthShell';

const ROLE_OPTIONS = [
    { value: 'student', title: 'Student / Student Helper', description: 'Access your learning workspace', icon: 'student' },
    { value: 'academic', title: 'CR / Faculty', description: 'Manage classes and academic activities', icon: 'academic' },
    { value: 'admin', title: 'Admin', description: 'Manage platform operations', icon: 'admin' },
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
    const [loading, setLoading] = useState(false);

    async function onSubmit(e) {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await signIn('credentials', { ...form, redirect: false });
            if (res?.error) {
                setError(res.error === 'CredentialsSignin'
                    ? 'Email, password, or account type is incorrect.'
                    : 'Sign-in is temporarily unavailable. Check your connection and try again shortly.');
                return;
            }
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
            setError('Could not reach the sign-in service. Check your connection and try again.');
        } finally {
            setLoading(false);
        }
    }

    const set = (k) => (e) => setForm((current) => ({ ...current, [k]: e.target.value }));

    return (
        <AuthShell
            title="Welcome back"
            hint="Pick up where your doubts left off."
            eyebrow="Return to your class"
            callout="Your open doubts and saved answers are waiting."
            footer={<>New here? <Link href="/register" className="underline underline-offset-4">Create an account</Link></>}
        >
            <form onSubmit={onSubmit} className="space-y-4">
                {error && <p role="alert" className="text-sm text-margin">{error}</p>}
                <fieldset>
                    <legend className="mb-2 block text-sm font-medium">Log in as</legend>
                    <div className="role-card-group" role="radiogroup" aria-label="Choose account type">
                        {ROLE_OPTIONS.map((role) => {
                            const selected = form.loginAs === role.value;
                            return (
                                <button
                                    key={role.value}
                                    type="button"
                                    role="radio"
                                    aria-checked={selected}
                                    className={`role-card${selected ? ' role-card-selected' : ''}`}
                                    onClick={() => setForm((current) => ({ ...current, loginAs: role.value }))}
                                >
                                    <span className="role-card-icon"><RoleIcon name={role.icon} /></span>
                                    <span className="role-card-copy">
                                        <span className="role-card-title">{role.title}</span>
                                        <span className="role-card-description">{role.description}</span>
                                    </span>
                                    <span className="role-card-indicator" aria-hidden="true">{selected ? '✓' : ''}</span>
                                </button>
                            );
                        })}
                    </div>
                    <p className="mt-1.5 text-xs text-graphite">Helpers sign in with their student or faculty account.</p>
                </fieldset>
                <div>
                    <label htmlFor="email" className="mb-1 block text-sm font-medium">College email</label>
                    <input id="email" type="email" className="field" autoComplete="email" onChange={set('email')} required />
                </div>
                <div>
                    <label htmlFor="password" className="mb-1 block text-sm font-medium">Password</label>
                    <input id="password" type="password" className="field" autoComplete="current-password"
                        onChange={set('password')} required />
                </div>
                <button className="btn w-full" disabled={loading}>
                    {loading ? 'Logging in...' : 'Log in'}
                </button>
            </form>
        </AuthShell>
    );
}
