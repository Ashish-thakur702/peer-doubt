import type { DefaultSession } from 'next-auth';
import type { Role } from '../src/lib/auth/roles.mjs';

declare module 'next-auth' {
    interface Session {
        user: {
            id: string;
            role: Role;
            roles: Role[];
            status: 'active' | 'suspended';
        } & DefaultSession['user'];
    }

    interface User {
        role: Role;
        roles: Role[];
    }
}

declare module 'next-auth/jwt' {
    interface JWT {
        id: string;
        role: Role;
        roles: Role[];
        status: 'active' | 'suspended';
    }
}
