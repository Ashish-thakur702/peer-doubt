export function publicRegistrationFields({ name, email, passwordHash }) {
    return { name, email, passwordHash, role: 'student', roles: ['student'], status: 'active' };
}
