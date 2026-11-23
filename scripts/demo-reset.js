import fs from 'node:fs';
import path from 'node:path';
import dns from 'node:dns';
import mongoose from 'mongoose';

if (!process.env.MONGODB_URI) {
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (fs.existsSync(envPath) && process.loadEnvFile) {
        process.loadEnvFile(envPath);
    }
}

if (process.env.MONGODB_DNS_SERVERS) {
    try {
        const servers = process.env.MONGODB_DNS_SERVERS.split(',').map((s) => s.trim()).filter(Boolean);
        if (servers.length) dns.setServers(servers);
    } catch {}
}

async function resetDemo() {
    console.log('Resetting demo staged state (Step 2B)...');
    const { default: connectDB } = await import('../src/lib/db.js');
    const { default: User } = await import('../src/models/User.js');
    const { default: Doubt } = await import('../src/models/Doubt.js');
    const { default: Answer } = await import('../src/models/Answer.js');
    const { default: KnowledgeEntry } = await import('../src/models/KnowledgeEntry.js');
    const { default: ModerationLog } = await import('../src/models/ModerationLog.js');
    const { default: Notification } = await import('../src/models/Notification.js');

    await connectDB();

    const crUser = await User.findOne({ email: 'aman.cr@unstuck.edu' });
    if (!crUser) {
        console.warn('CR user aman.cr@unstuck.edu not found. Run "npm run seed:faculty-cr" first.');
        return;
    }

    // 1. Revert helper reputation if it was awarded live during rehearsal
    const liveVerifiedAnswer = await Answer.findOne({ demoKey: 'demo:stage:answer-quicksort-random' });
    if (liveVerifiedAnswer?.demoReputationAwarded) {
        console.log(`Reverting 10 reputation awarded during rehearsal to helper ${liveVerifiedAnswer.helper}...`);
        await User.updateOne(
            { _id: liveVerifiedAnswer.helper },
            { $inc: { 'helperProfile.reputation': -10 } }
        );
    }

    // 2. Remove any knowledge entries created during rehearsal from staged answers
    const delKnowledge = await KnowledgeEntry.deleteMany({
        isDemoData: true,
        $or: [
            { demoKey: /^demo:stage:/ },
            { answer: liveVerifiedAnswer?._id },
        ],
    });
    console.log(`Deleted rehearsal knowledge entries: ${delKnowledge.deletedCount}`);

    // 3. Remove rehearsal notifications from staged actions
    const delNotif = await Notification.deleteMany({
        isDemoData: true,
        demoKey: /^demo:stage:/,
    });
    console.log(`Deleted rehearsal notifications: ${delNotif.deletedCount}`);

    // 4. Remove rehearsal moderation logs from staged actions
    const delLogs = await ModerationLog.deleteMany({
        isDemoData: true,
        demoKey: /^demo:stage:/,
    });
    console.log(`Deleted rehearsal moderation logs: ${delLogs.deletedCount}`);

    // 5. Reset Staged Doubt #1 (Quicksort Random Pivot)
    await Doubt.updateOne(
        { demoKey: 'demo:stage:doubt-quicksort-random' },
        { $set: { status: 'ANSWERED' } }
    );

    // 6. Reset Staged Answer #1 (Quicksort Random Pivot) -> FACULTY_PENDING
    await Answer.updateOne(
        { demoKey: 'demo:stage:answer-quicksort-random' },
        {
            $set: {
                status: 'FACULTY_PENDING',
                demoReputationAwarded: false,
                moderationHistory: [
                    {
                        moderator: crUser._id,
                        action: 'FORWARDED_TO_FACULTY',
                        createdAt: new Date(Date.now() - 2 * 3600 * 1000),
                    },
                ],
            },
            $unset: {
                verifiedBy: 1,
                verifiedAt: 1,
                reviewAssignedTo: 1,
                reviewAssignedAt: 1,
            },
        }
    );

    // 7. Reset Staged Doubt #2 (Merge Sort Stability)
    await Doubt.updateOne(
        { demoKey: 'demo:stage:doubt-mergesort-stability' },
        { $set: { status: 'ANSWERED' } }
    );

    // 8. Reset Staged Answer #2 (Merge Sort Stability) -> FACULTY_PENDING
    await Answer.updateOne(
        { demoKey: 'demo:stage:answer-mergesort-weak' },
        {
            $set: {
                status: 'FACULTY_PENDING',
                moderationHistory: [
                    {
                        moderator: crUser._id,
                        action: 'FORWARDED_TO_FACULTY',
                        createdAt: new Date(Date.now() - 1 * 3600 * 1000),
                    },
                ],
            },
            $unset: {
                verifiedBy: 1,
                verifiedAt: 1,
                reviewAssignedTo: 1,
                reviewAssignedAt: 1,
            },
        }
    );

    // 9. Reset CR Staged Answer #1 (Red-Black Tree) -> PENDING
    await Answer.updateOne(
        { demoKey: 'demo:stage:answer-rbt-pending' },
        {
            $set: {
                status: 'PENDING',
                moderationHistory: [],
            },
            $unset: {
                reviewAssignedTo: 1,
                reviewAssignedAt: 1,
            },
        }
    );

    // 10. Reset CR Staged Answer #2 (Knapsack Greedy vs DP) -> PENDING
    await Answer.updateOne(
        { demoKey: 'demo:stage:answer-knapsack-cr-pending' },
        {
            $set: {
                status: 'PENDING',
                moderationHistory: [],
            },
            $unset: {
                reviewAssignedTo: 1,
                reviewAssignedAt: 1,
            },
        }
    );

    console.log('Demo staged state successfully restored!');
    console.log('Ready for live presentation:');
    console.log('- CR Queue: 2 pending answers ready to review & forward');
    console.log('- Faculty Queue: 2 forwarded answers ready to verify / reject');
}

resetDemo()
    .catch((err) => {
        console.error('DEMO_RESET_FAILED:', err);
        process.exitCode = 1;
    })
    .finally(async () => {
        if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    });
