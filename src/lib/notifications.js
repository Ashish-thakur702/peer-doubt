import Notification from '@/models/Notification';

export async function notifyUsers(recipients, notification) {
    const ids = [...new Set((recipients || []).filter(Boolean).map(String))];
    if (!ids.length) return;
    const content = { ...notification, message: String(notification.message || '').trim().slice(0, 240) };
    await Promise.all(ids.map((recipient) => {
        const dedupeKey = `${content.dedupeKey}:${recipient}`;
        const demoKey = content.demoKey ? `${content.demoKey}:${recipient}` : undefined;
        return Notification.updateOne(
            { recipient, dedupeKey },
            { $setOnInsert: { ...content, ...(demoKey ? { isDemoData: true, demoKey } : {}), recipient, dedupeKey } },
            { upsert: true }
        );
    }));
}
