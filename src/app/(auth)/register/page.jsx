'use client';
import { fetchWithTimeout } from '@/lib/client-fetch';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AuthShell from '@/components/AuthShell';
import { authServiceMessage } from '@/lib/auth/client-messages';

export default function Register() {
    const router = useRouter();
    const [form, setForm] = useState({ name: '', email: '', password: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    async function onSubmit(e) {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await fetchWithTimeout('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                if (res.status >= 500) {
                    try {
                        const health = await fetchWithTimeout('/api/auth/health', { cache: 'no-store' });
                        const status = await health.json().catch(() => ({}));
                        if (!health.ok) return setError(authServiceMessage(status.issue));
                    } catch { return setError(authServiceMessage('service_unreachable')); }
                }
                return setError(data.msg || `Server error (${res.status})`);
            }
            router.push('/login');
        } catch {
            setError('Could not reach the server. Check your connection and try again.');
        } finally {
            setLoading(false);
        }
    }

    const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

    return (
        <AuthShell
            title="Create your account"
            hint="Ask doubts, answer a classmate's, and build the class answer library."
            footer={<>Already registered? <Link href="/login" className="underline underline-offset-4">Log in</Link></>}
        >
            <form onSubmit={onSubmit} className="auth-form space-y-4">
                {error && <p role="alert" className="auth-error-notice">{error}</p>}
                <div>
                    <label htmlFor="name" className="mb-1 block text-sm font-medium">Name</label>
                    <input id="name" className="field" autoComplete="name" minLength={2} maxLength={100} onChange={set('name')} required />
                </div>
                <div>
                    <label htmlFor="email" className="mb-1 block text-sm font-medium">Account email</label>
                    <input id="email" type="email" className="field" autoComplete="email" autoCapitalize="none" spellCheck="false" onChange={set('email')} required />
                </div>
                <div>
                    <label htmlFor="password" className="mb-1 block text-sm font-medium">Password</label>
                    <input id="password" type="password" className="field" autoComplete="new-password"
                        placeholder="At least 8 characters" minLength={8} maxLength={72} onChange={set('password')} required />
                </div>
                <button className="btn-primary auth-submit w-full" disabled={loading}>
                    {loading ? <><span className="auth-spinner" aria-hidden="true" />Creating account…</> : <>Create account <span aria-hidden="true">→</span></>}
                </button>
                <p className="auth-footnote">Use at least 8 characters. Your password is securely hashed before storage.</p>
            </form>
        </AuthShell>
    );
}
