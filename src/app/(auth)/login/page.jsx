'use client';
import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AuthShell from '@/components/AuthShell';

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

    const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

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
                <div>
                    <label htmlFor="loginAs" className="mb-1 block text-sm font-medium">Log in as</label>
                    <select id="loginAs" className="field" value={form.loginAs} onChange={set('loginAs')}>
                        <option value="student">Student / student helper</option>
                        <option value="academic">CR / Faculty</option>
                        <option value="admin">Admin</option>
                    </select>
                    <p className="mt-1.5 text-xs text-graphite">Helpers sign in with their student or faculty account.</p>
                </div>
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
