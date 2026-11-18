import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import connectDB from '../src/lib/db.js';
import User from '../src/models/User.js';

const TEST_USERS = [
    { role: 'student', name: '[RBAC TEST] Student', email: 'unstuck-rbac+student@example.test', roles: ['student'] },
    {
        role: 'helper', name: '[RBAC TEST] Helper', email: 'unstuck-rbac+helper@example.test', roles: ['student', 'helper'],
        isHelper: true, courses: ['OS'], availability: true,
        helperProfile: { courses: ['OS'], topics: ['Deadlocks'], isWilling: true, isHelper: true, availability: true },
    },
    { role: 'cr', name: '[RBAC TEST] Course Representative', email: 'unstuck-rbac+cr@example.test', roles: ['cr'], assignedCourses: ['OS'] },
    { role: 'faculty', name: '[RBAC TEST] Faculty', email: 'unstuck-rbac+faculty@example.test', roles: ['faculty'], department: 'Computer Science', assignedCourses: ['DAA', 'OS', 'DBMS', 'CN'] },
    { role: 'admin', name: '[RBAC TEST] Admin', email: 'unstuck-rbac+admin@example.test', roles: ['admin'] },
];

function assertDevelopmentTarget() {
    if (!process.argv.includes('--confirm-rbac-users'))
        throw new Error('Pass --confirm-rbac-users to create the prefixed RBAC test accounts.');
    if (process.env.NODE_ENV === 'production' || process.env.VERCEL)
        throw new Error('RBAC test accounts cannot be created in a production deployment.');
    const uri = process.env.MONGODB_URI?.trim();
    if (!uri) throw new Error('MONGODB_URI is required.');
    const uriDatabase = uri.match(/^mongodb(?:\+srv)?:\/\/[^/]+\/([^?]*)/i)?.[1];
    const database = process.env.MONGODB_DB?.trim() || (uriDatabase ? decodeURIComponent(uriDatabase) : 'Doubt');
    if (!database || ['admin', 'local', 'config'].includes(database.toLowerCase()) || /(^|[-_])(prod|production|live)([-_]|$)/i.test(database))
        throw new Error('The configured database is not an allowed development application database.');
    if (!process.env.RBAC_TEST_PASSWORD || process.env.RBAC_TEST_PASSWORD.length < 10)
        throw new Error('Set RBAC_TEST_PASSWORD to a local-only password of at least 10 characters.');
    return database;
}

async function seed() {
    const database = assertDevelopmentTarget();
    await connectDB();
    if (mongoose.connection.db.databaseName !== database)
        throw new Error('Connected database does not match the configured development database.');
    const passwordHash = await bcrypt.hash(process.env.RBAC_TEST_PASSWORD, 12);
    const results = [];
    for (const testUser of TEST_USERS) {
        const existing = await User.findOne({ email: testUser.email }).select('_id').lean();
        if (existing) {
            results.push({ role: testUser.role, email: testUser.email, created: false, reason: 'already exists; left unchanged' });
            continue;
        }
        await User.create({
            ...testUser,
            passwordHash,
            status: 'active',
            isSuspended: false,
        });
        results.push({ role: testUser.role, email: testUser.email, created: true });
    }
    console.log(JSON.stringify({ database, users: results }, null, 2));
}

seed()
    .catch((error) => {
        console.error(error.message || 'Could not create RBAC test accounts.');
        if (error.name && error.name !== 'Error') console.error(`Database error type: ${error.name}${error.code ? ` (${error.code})` : ''}`);
        process.exitCode = 1;
    })
    .finally(async () => {
        if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    });
