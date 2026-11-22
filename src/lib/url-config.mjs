export function cleanEnvironmentValue(value) {
    if (typeof value !== 'string') return '';
    let cleaned = value.trim();
    while (cleaned.length >= 2) {
        const first = cleaned[0];
        const last = cleaned.at(-1);
        if ((first !== '"' && first !== "'") || last !== first) break;
        cleaned = cleaned.slice(1, -1).trim();
    }
    return cleaned;
}

function normalizeHttpUrl(value) {
    const cleaned = cleanEnvironmentValue(value);
    if (!cleaned || cleaned.startsWith('/')) return null;

    const localHost = /^(?:localhost|127(?:\.\d{1,3}){3}|\[::1\])(?::\d+)?(?:\/|$)/i.test(cleaned);
    const explicitHttp = /^https?:\/\//i.test(cleaned);
    if (!explicitHttp && /^[a-z][a-z\d+.-]*:/i.test(cleaned) && !localHost) return null;

    const candidate = explicitHttp
        ? cleaned
        : `${localHost ? 'http' : 'https'}://${cleaned}`;

    try {
        const url = new URL(candidate);
        if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) return null;
        if (url.search || url.hash) return null;
        return `${url.origin}${url.pathname === '/' ? '' : url.pathname.replace(/\/+$/, '')}`;
    } catch {
        return null;
    }
}

export function getAuthUrlConfig(environment = process.env) {
    const configuredUrl = normalizeHttpUrl(environment.NEXTAUTH_URL);
    const deploymentUrl = normalizeHttpUrl(environment.VERCEL_URL);
    const url = configuredUrl || deploymentUrl || 'http://localhost:3000';
    const internalUrl = normalizeHttpUrl(environment.NEXTAUTH_URL_INTERNAL) || url;

    return {
        url,
        internalUrl,
        configured: Boolean(configuredUrl || deploymentUrl),
    };
}
