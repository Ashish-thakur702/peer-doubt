import { getToken } from 'next-auth/jwt';
import { NextResponse } from 'next/server';

export async function proxy(req) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    const { pathname } = req.nextUrl;

    if (!token) {
        const url = new URL('/login', req.url);
        url.searchParams.set('callbackUrl', `${pathname}${req.nextUrl.search}`);
        return NextResponse.redirect(url);
    }

    // Role checks happen in server layouts and API guards against MongoDB.
    // A token is only used here to detect sign-in, never to authorize a role.
    return NextResponse.next();
}

export const config = {
    matcher: ['/doubts/:path*', '/helper/:path*', '/moderation/:path*', '/knowledge/:path*', '/notifications/:path*', '/admin/:path*'],
};
