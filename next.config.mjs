import { getAuthUrlConfig } from './src/lib/url-config.mjs';

const authUrls = getAuthUrlConfig(process.env);

// NextAuth's client module parses NEXTAUTH_URL at import time during static prerendering.
// Normalize it before Next compiles or prerenders any route, including the not-found page.
process.env.NEXTAUTH_URL = authUrls.url;
process.env.NEXTAUTH_URL_INTERNAL = authUrls.internalUrl;

/** @type {import('next').NextConfig} */
const nextConfig = {
    env: {
        NEXTAUTH_URL: authUrls.url,
    },
    // Allow the dev server to be opened from this machine's LAN address.
    allowedDevOrigins: ['10.35.19.172', '10.36.72.23:3000', '10.36.72.23', 'localhost'],
    async headers() {
        return [{
            source: '/:path*',
            headers: [
                { key: 'X-Content-Type-Options', value: 'nosniff' },
                { key: 'X-Frame-Options', value: 'DENY' },
                { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
                { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
            ],
        }];
    },
};

export default nextConfig;
