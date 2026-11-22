import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import connectDB from '@/lib/db';
import User from '@/models/User';
import { canSignInAs } from '@/lib/auth/login-role.mjs';

export const authOptions = {
    secret: process.env.NEXTAUTH_SECRET,
    session: { strategy: 'jwt' },
    pages: { signIn: '/login' },
    providers: [
        CredentialsProvider({
            credentials: { email: {}, password: {}, loginAs: {} },
            async authorize(credentials) {
                const email = typeof credentials?.email === 'string' ? credentials.email.trim().toLowerCase() : '';
                const password = credentials?.password;
                const loginAs = credentials?.loginAs;
                if (!email || typeof password !== 'string' || !password || typeof loginAs !== 'string') return null;
                let user;
                try {
                    await connectDB();
                    user = await User.findOne({ email });
                } catch (error) {
                    console.error('AUTH_DATABASE_UNAVAILABLE', {
                        name: error?.name || 'Error',
                        code: error?.code || error?.cause?.code || 'UNKNOWN',
                    });
                    const authError = new Error('Authentication database unavailable');
                    authError.code = 'AUTH_DATABASE_UNAVAILABLE';
                    throw authError;
                }
                if (!user?.passwordHash || user.isSuspended || user.status === 'suspended') return null;
                const ok = await bcrypt.compare(password, user.passwordHash);
                if (!ok || !canSignInAs(user, loginAs)) return null;
                return { id: user._id.toString(), name: user.name, email: user.email, role: user.role, roles: user.roles, status: user.status || 'active' };
            },
        }),
    ],
    callbacks: {
        async jwt({ token, user, trigger }) {
            if (user) {
                token.id = user.id;
                token.role = user.role;
                token.roles = user.roles;
                token.status = user.status || 'active';
            } else if (trigger === 'update' && token.id) {
                await connectDB();
                const currentUser = await User.findById(token.id).select('role roles status isSuspended').lean();
                if (currentUser) {
                    token.role = currentUser.role;
                    token.roles = currentUser.roles || [currentUser.role || 'student'];
                    token.status = currentUser.status || (currentUser.isSuspended ? 'suspended' : 'active');
                }
            }
            return token;
        },
        async session({ session, token }) {
            session.user.id = token.id;
            session.user.role = token.role || 'student';
            session.user.roles = token.roles;
            session.user.status = token.status || 'active';
            return session;
        },
    },
};
