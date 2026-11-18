import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/session';

export default async function NotificationsLayout({ children }) {
    const { error, status } = await requireAuth();
    if (error) redirect(status === 401 ? '/login' : '/access-denied');
    return children;
}
