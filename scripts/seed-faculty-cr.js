import fs from 'node:fs';
import path from 'node:path';
import dns from 'node:dns';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

// Load .env.local if not already loaded in environment
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

const WEEKS_MS = 7 * 24 * 60 * 60 * 1000;
const DAYS_MS = 24 * 60 * 60 * 1000;
const HOURS_MS = 60 * 60 * 1000;

function pastDate(weeksAgo, daysAgo = 0, hoursAgo = 0) {
    return new Date(Date.now() - (weeksAgo * WEEKS_MS + daysAgo * DAYS_MS + hoursAgo * HOURS_MS));
}

async function main() {
    // Dynamic import after environment is loaded
    const { default: connectDB } = await import('../src/lib/db.js');
    const { default: User } = await import('../src/models/User.js');
    const { default: Doubt } = await import('../src/models/Doubt.js');
    const { default: Answer } = await import('../src/models/Answer.js');
    const { default: KnowledgeEntry } = await import('../src/models/KnowledgeEntry.js');
    const { default: ModerationLog } = await import('../src/models/ModerationLog.js');
    const { default: Notification } = await import('../src/models/Notification.js');

    if (process.argv.includes('--cleanup')) {
        console.log('Running cleanup for demo data (isDemoData: true)...');
        await connectDB();

        const [u, d, a, k, m, n] = await Promise.all([
            User.deleteMany({ isDemoData: true }),
            Doubt.deleteMany({ isDemoData: true }),
            Answer.deleteMany({ isDemoData: true }),
            KnowledgeEntry.deleteMany({ isDemoData: true }),
            ModerationLog.deleteMany({ isDemoData: true }),
            Notification.deleteMany({ isDemoData: true }),
        ]);

        console.log('Cleanup completed:');
        console.log(`- Users removed: ${u.deletedCount}`);
        console.log(`- Doubts removed: ${d.deletedCount}`);
        console.log(`- Answers removed: ${a.deletedCount}`);
        console.log(`- Knowledge entries removed: ${k.deletedCount}`);
        console.log(`- Moderation logs removed: ${m.deletedCount}`);
        console.log(`- Notifications removed: ${n.deletedCount}`);
        return;
    }

    console.log('Connecting to database via app connectDB helper...');
    await connectDB();
    console.log(`Connected to database: ${mongoose.connection.db.databaseName}`);

    // Look up EXISTING students and helpers
    const existingUsers = await User.find({}).lean();
    const students = existingUsers.filter((u) => !u.isDemoData && (u.roles?.includes('student') || u.role === 'student') && !u.roles?.includes('faculty') && !u.roles?.includes('admin'));
    const helpers = existingUsers.filter((u) => !u.isDemoData && (u.isHelper || u.roles?.includes('helper') || u.helperProfile?.isHelper || u.helperProfile?.isWilling));

    if (!students.length) throw new Error('No existing student users found in database.');
    if (!helpers.length) throw new Error('No existing helper users found in database.');

    const priyaStudent = students.find((u) => u.email === 'priya.sharma@student.mes.ac.in') || students[0];
    const rahulStudent = students.find((u) => u.email === 'rahul.verma@student.mes.ac.in') || students[1] || students[0];
    const snehaStudent = students.find((u) => u.email === 'sneha.reddy@student.mes.ac.in') || students[2] || students[0];

    const arjunHelper = helpers.find((u) => u.email === 'arjun.patel@student.mes.ac.in') || helpers[0];
    const raviHelper = helpers.find((u) => u.email === 'ravimishra@gmail.com') || helpers[1] || helpers[0];
    const ashishHelper = helpers.find((u) => u.email === 'ashishpersonalteam@gmail.com') || helpers[2] || helpers[0];

    console.log('Reusing existing users:');
    console.log(`- Students: ${priyaStudent.name} (${priyaStudent.email}), ${rahulStudent.name} (${rahulStudent.email}), ${snehaStudent.name} (${snehaStudent.email})`);
    console.log(`- Helpers: ${arjunHelper.name} (${arjunHelper.email}), ${raviHelper.name} (${raviHelper.email}), ${ashishHelper.name} (${ashishHelper.email})`);

    // STEP 1: CREATE THE ACCOUNTS
    const facultyPasswordHash = await bcrypt.hash('Faculty@123', 12);
    const crPasswordHash = await bcrypt.hash('CR@12345', 12);
    const adminPasswordHash = await bcrypt.hash('Admin@123', 12);

    const adminUser = await User.findOneAndUpdate(
        { email: 'admin@unstuck.edu' },
        {
            $set: {
                name: 'Dr. Rajesh Khanna',
                email: 'admin@unstuck.edu',
                passwordHash: adminPasswordHash,
                role: 'admin',
                roles: ['admin'],
                status: 'active',
                isSuspended: false,
                department: 'CSE',
                designation: 'Administrator',
                bio: 'Lead System Administrator and Academic Governance Coordinator for CSE.',
                joinedAt: new Date('2020-01-10'),
                isDemoData: true,
                demoKey: 'demo:user:admin:rajesh-khanna',
            },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const facultyUser = await User.findOneAndUpdate(
        { email: 'neha.sharma@unstuck.edu' },
        {
            $set: {
                name: 'Dr. Neha Sharma',
                email: 'neha.sharma@unstuck.edu',
                passwordHash: facultyPasswordHash,
                role: 'faculty',
                roles: ['faculty'],
                status: 'active',
                isSuspended: false,
                department: 'CSE',
                assignedCourses: ['DAA'],
                designation: 'Associate Professor',
                bio: 'Associate Professor in Computer Science & Engineering. Specializes in Data Structures, Advanced Algorithms, and Computational Complexity.',
                joinedAt: new Date('2021-08-16'),
                isDemoData: true,
                demoKey: 'demo:user:faculty:neha-sharma',
            },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const crUser = await User.findOneAndUpdate(
        { email: 'aman.cr@unstuck.edu' },
        {
            $set: {
                name: 'Aman Gupta',
                email: 'aman.cr@unstuck.edu',
                passwordHash: crPasswordHash,
                role: 'cr',
                roles: ['cr'],
                status: 'active',
                isSuspended: false,
                department: 'CSE',
                assignedCourses: ['DAA', 'OS', 'DBMS', 'CN'],
                semester: 5,
                section: 'A',
                rollNumber: '21CSE042',
                joinedAt: new Date('2022-08-01'),
                isDemoData: true,
                demoKey: 'demo:user:cr:aman-gupta',
            },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    console.log(`Admin account ready: ${adminUser.email} (${adminUser._id})`);
    console.log(`Faculty account ready: ${facultyUser.email} (${facultyUser._id})`);
    console.log(`CR account ready: ${crUser.email} (${crUser._id})`);

    async function upsertDoubt(demoKey, data) {
        return Doubt.findOneAndUpdate(
            { demoKey },
            { $set: { ...data, isDemoData: true, demoKey } },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
    }

    async function upsertAnswer(demoKey, data) {
        return Answer.findOneAndUpdate(
            { demoKey },
            { $set: { ...data, isDemoData: true, demoKey } },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
    }

    async function upsertKnowledge(demoKey, data) {
        return KnowledgeEntry.findOneAndUpdate(
            { demoKey },
            { $set: { ...data, isDemoData: true, demoKey } },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
    }

    async function upsertModLog(demoKey, data) {
        return ModerationLog.findOneAndUpdate(
            { demoKey },
            { $set: { ...data, isDemoData: true, demoKey, idempotencyKey: demoKey } },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
    }

    async function upsertNotification(demoKey, data) {
        return Notification.findOneAndUpdate(
            { demoKey },
            { $set: { ...data, isDemoData: true, demoKey, dedupeKey: demoKey } },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
    }

    // STEP 2A: HISTORY RECORDS
    // 1. Quicksort Canonical Doubt & Verified Answer
    const qsCanonicalDate = pastDate(6, 2, 4);
    const qsForwardDate = new Date(qsCanonicalDate.getTime() - 2 * HOURS_MS);
    const qsCanonicalDoubt = await upsertDoubt('demo:doubt:quicksort-canonical', {
        title: 'Quicksort time complexity explained',
        description: 'Explain the best, average, and worst-case time complexity of Quicksort. Why does the worst case occur on sorted arrays with a naive pivot, and how can randomized pivot selection or median-of-three avoid it?',
        course: 'DAA',
        topic: 'Complexity',
        author: priyaStudent._id,
        status: 'VERIFIED',
        assignedHelper: arjunHelper._id,
        tags: ['quicksort', 'complexity', 'divide-and-conquer', 'algorithms'],
        duplicateLinkCount: 2,
        createdAt: new Date(qsForwardDate.getTime() - 4 * HOURS_MS),
    });

    const qsCanonicalAnswerContent = `Quicksort is a divide-and-conquer algorithm with distinct time complexity profiles based on pivot selection:

1. Best Case — O(n log n):
Occurs when the partition splits the array into two equal halves at every step:
T(n) = 2T(n/2) + O(n). By Master Theorem (Case 2), T(n) = O(n log n).

2. Average Case — O(n log n):
Assuming all permutations are equally likely, balanced and unbalanced partitions alternate. The recurrence yields E[T(n)] = 2n ln(n) + O(n) ≈ 1.39 n log2(n) = O(n log n).

3. Worst Case — O(n²):
Occurs when the partition is maximally unbalanced (0 elements on one side, n-1 on the other) at every step.
Recurrence: T(n) = T(n-1) + T(0) + cn = T(n-1) + cn = c ∑(i=1 to n) i = c * n(n+1)/2 = O(n²).
Why naive pivot selection triggers this on sorted inputs:
If the first or last element is chosen deterministically as the pivot in an already sorted or reverse-sorted array, the chosen pivot is always the minimum or maximum element. No elements fall to one side of the pivot, producing maximum recursion depth n.

4. Avoiding the Worst Case:
- Randomized Pivot: Uniformly choose a random index in [low, high] and swap with the pivot before partitioning. This makes worst-case behavior independent of initial input ordering; an adversary cannot craft a fixed worst-case array.
- Median-of-Three: Select the median of {arr[low], arr[mid], arr[high]} as the pivot. This guarantees balanced splits on sorted, reverse-sorted, and organ-pipe arrays without generating random numbers.`;

    const qsCanonicalAnswer = await upsertAnswer('demo:answer:quicksort-canonical', {
        doubt: qsCanonicalDoubt._id,
        helper: arjunHelper._id,
        content: qsCanonicalAnswerContent,
        status: 'VERIFIED',
        verifiedBy: facultyUser._id,
        verifiedAt: qsCanonicalDate,
        createdAt: new Date(qsForwardDate.getTime() - 2 * HOURS_MS),
        moderationHistory: [
            {
                moderator: crUser._id,
                action: 'FORWARDED_TO_FACULTY',
                createdAt: qsForwardDate,
            },
            {
                moderator: facultyUser._id,
                action: 'VERIFIED',
                rating: 5,
                feedback: 'Exceptional, mathematically rigorous explanation of recurrence relations and partition geometry. Clearly demonstrates randomized vs median-of-three mitigation.',
                createdAt: qsCanonicalDate,
            },
        ],
    });

    await upsertKnowledge('demo:knowledge:quicksort-canonical', {
        answer: qsCanonicalAnswer._id,
        doubt: qsCanonicalDoubt._id,
        verifiedBy: facultyUser._id,
        verifiedAt: qsCanonicalDate,
        title: 'Quicksort time complexity explained',
        course: 'DAA',
        topic: 'Complexity',
        question: qsCanonicalDoubt.description,
        answerContent: qsCanonicalAnswerContent,
        tags: ['quicksort', 'complexity', 'divide-and-conquer', 'algorithms'],
        helpfulCount: 14,
        viewCount: 68,
        status: 'ACTIVE',
    });

    await upsertModLog('demo:modlog:cr:quicksort-canonical', {
        entityType: 'answer',
        entityId: qsCanonicalAnswer._id,
        action: 'FORWARDED_TO_FACULTY',
        moderator: crUser._id,
        relatedEntity: qsCanonicalDoubt._id,
        relatedEntityType: 'doubt',
        createdAt: qsForwardDate,
    });

    await upsertModLog('demo:modlog:faculty:quicksort-canonical', {
        entityType: 'answer',
        entityId: qsCanonicalAnswer._id,
        action: 'VERIFIED',
        moderator: facultyUser._id,
        rating: 5,
        feedback: 'Exceptional, mathematically rigorous explanation of recurrence relations and partition geometry.',
        relatedEntity: qsCanonicalDoubt._id,
        relatedEntityType: 'doubt',
        createdAt: qsCanonicalDate,
    });

    await upsertNotification('demo:notif:quicksort-helper', {
        recipient: arjunHelper._id,
        type: 'ANSWER_VERIFIED',
        doubt: qsCanonicalDoubt._id,
        answer: qsCanonicalAnswer._id,
        message: 'Your answer was verified by Dr. Neha Sharma and published to the Knowledge Library.',
        href: `/doubts/${qsCanonicalDoubt._id}#answer-${qsCanonicalAnswer._id}`,
        readAt: qsCanonicalDate,
    });

    // 2. Near-duplicate doubts linked to the canonical verified doubt
    const dup1Date = pastDate(5, 4, 3);
    const dup1 = await upsertDoubt('demo:doubt:quicksort-dup-1', {
        title: 'Why is quicksort worst case O(n^2)?',
        description: 'Why is quicksort worst case O(n^2)? Does it only happen when the array is sorted, and how does the partition divide the elements in that case?',
        course: 'DAA',
        topic: 'Complexity',
        author: rahulStudent._id,
        status: 'DUPLICATE',
        duplicateOf: qsCanonicalDoubt._id,
        duplicateLinkCount: 0,
        createdAt: dup1Date,
    });

    await upsertModLog('demo:modlog:cr:dup-1', {
        entityType: 'doubt',
        entityId: dup1._id,
        action: 'DUPLICATE_CONFIRMED',
        moderator: crUser._id,
        reason: 'Duplicate of verified canonical Quicksort complexity question.',
        relatedEntity: qsCanonicalDoubt._id,
        relatedEntityType: 'doubt',
        createdAt: new Date(dup1Date.getTime() + 1 * HOURS_MS),
    });

    const dup2Date = pastDate(4, 2, 6);
    const dup2 = await upsertDoubt('demo:doubt:quicksort-dup-2', {
        title: 'Quicksort worst case complexity on sorted input',
        description: 'Can someone explain why quicksort takes O(n^2) on sorted inputs? Is there a way to prevent this without switching to merge sort?',
        course: 'DAA',
        topic: 'Complexity',
        author: snehaStudent._id,
        status: 'DUPLICATE',
        duplicateOf: qsCanonicalDoubt._id,
        duplicateLinkCount: 0,
        createdAt: dup2Date,
    });

    await upsertModLog('demo:modlog:cr:dup-2', {
        entityType: 'doubt',
        entityId: dup2._id,
        action: 'DUPLICATE_CONFIRMED',
        moderator: crUser._id,
        reason: 'Direct duplicate of canonical Quicksort complexity explanation.',
        relatedEntity: qsCanonicalDoubt._id,
        relatedEntityType: 'doubt',
        createdAt: new Date(dup2Date.getTime() + 1 * HOURS_MS),
    });

    // 3. Additional Verified History Answers (5 more verified records)
    const verifiedHistory = [
        {
            key: 'master-theorem',
            title: 'Master Theorem applicability for T(n) = 2T(n/2) + n log n',
            topic: 'Divide and Conquer',
            student: rahulStudent,
            helper: raviHelper,
            rating: 5,
            weeks: 7,
            tags: ['recurrence', 'master-theorem', 'divide-and-conquer', 'complexity'],
            feedback: 'Precise application of Master Theorem Case 2 logarithmic extension. Clean algebraic derivation.',
            answer: `For recurrence T(n) = 2T(n/2) + n log n:
Here a = 2, b = 2, and f(n) = n log n.
We compute n^(log_b a) = n^(log_2 2) = n^1 = n.
Compare f(n) with n^(log_b a):
f(n) = n log n = n^1 * log^1(n).
Standard Master Theorem Case 2 has an extended form:
If f(n) = Θ(n^(log_b a) * log^k(n)) for k >= 0, then:
T(n) = Θ(n^(log_b a) * log^(k+1)(n)).
Here k = 1. Therefore:
T(n) = Θ(n * log^(1+1)(n)) = Θ(n log² n).
Notice this cannot be solved by the basic 3-case Master Theorem because f(n) is not polynomially larger than n, but the log extension handles it directly.`,
        },
        {
            key: 'dijkstra-bellman',
            title: 'Dijkstra vs Bellman-Ford on graphs with negative edge weights',
            topic: 'Graph Algorithms',
            student: snehaStudent,
            helper: arjunHelper,
            rating: 5,
            weeks: 5,
            tags: ['graphs', 'dijkstra', 'bellman-ford', 'shortest-paths'],
            feedback: 'Strong counterexample clearly illustrating why Dijkstra greedy choice fails with negative weights.',
            answer: `Dijkstra's algorithm relies on the greedy property: once a vertex u is marked visited (extracted from min-priority queue), its distance dist[u] is assumed permanently optimal and never relaxed again.
With negative edge weights, this greedy invariant breaks:
Consider graph:
S -> A with weight 3
S -> B with weight 5
A -> B with weight -4
Dijkstra visits A first (dist 3), then B (dist 5). Once B is visited with dist 5, it cannot re-evaluate B when checking edge A -> B (3 + (-4) = -1 < 5), producing an incorrect shortest path.

Bellman-Ford solves this by relaxing all |E| edges |V|-1 times. Since any simple path has at most |V|-1 edges, relaxing all edges guarantees shortest distances even with negative weights (O(V*E)). An extra relaxation pass detects negative-weight cycles.`,
        },
        {
            key: 'knapsack-dp',
            title: '0/1 Knapsack vs Fractional Knapsack Dynamic Programming approach',
            topic: 'Dynamic Programming',
            student: priyaStudent,
            helper: ashishHelper,
            rating: 4,
            weeks: 3,
            tags: ['knapsack', 'dynamic-programming', 'greedy', 'optimization'],
            feedback: 'Clear distinction between greedy choice property and optimal substructure. Well-structured DP table example.',
            answer: `The fundamental distinction between 0/1 Knapsack and Fractional Knapsack lies in whether items can be subdivided:

1. Fractional Knapsack (Greedy):
Items can be broken down. Calculating the value-to-weight ratio (v_i / w_i) and greedily picking highest density items guarantees optimality. Running time is O(n log n) due to sorting.

2. 0/1 Knapsack (Dynamic Programming):
Items must be taken completely or left behind. Greedily selecting high ratio items fails because unused capacity cannot be filled with fractions of high-value heavy items.
DP Recurrence:
dp[i][w] = max(dp[i-1][w], v[i-1] + dp[i-1][w - wt[i-1]]) if wt[i-1] <= w, else dp[i-1][w].
Time Complexity: O(n * W), where W is capacity (pseudo-polynomial). Space can be optimized to O(W) using a 1D array traversed backwards.`,
        },
        {
            key: 'floyd-warshall',
            title: 'Floyd-Warshall all-pairs shortest paths time complexity derivation',
            topic: 'Complexity',
            student: rahulStudent,
            helper: arjunHelper,
            rating: 5,
            weeks: 2,
            tags: ['floyd-warshall', 'all-pairs', 'graphs', 'dynamic-programming'],
            feedback: 'Clean formulation of the intermediate vertex recurrence and triply-nested loop complexity.',
            answer: `Floyd-Warshall computes shortest paths between all pairs of vertices in a directed graph in O(V³) time using dynamic programming.

Recurrence:
Let dist[k][i][j] be the length of the shortest path from vertex i to vertex j using only vertices from {1, 2, ..., k} as intermediate nodes.
dist[k][i][j] = min(dist[k-1][i][j], dist[k-1][i][k] + dist[k-1][k][j])
Base case: dist[0][i][j] = weight(i, j) if edge exists, 0 if i == j, ∞ otherwise.

Complexity Derivation:
The algorithm uses three nested loops:
- Outer loop k runs from 1 to V (intermediate vertex candidates).
- Middle loop i runs from 1 to V (source vertex).
- Inner loop j runs from 1 to V (destination vertex).
Inside the inner loop, constant number of operations O(1) occur.
Total operations = V * V * V * O(1) = O(V³).
Space Complexity: O(V²) since state k only depends on state k-1.`,
        },
        {
            key: 'huffman-greedy',
            title: 'Huffman Coding optimality proof using Greedy Choice Property',
            topic: 'Greedy',
            student: snehaStudent,
            helper: raviHelper,
            rating: 4,
            weeks: 1,
            tags: ['huffman', 'greedy', 'prefix-codes', 'compression'],
            feedback: 'Accurate inductive proof. Sibling swap lemma is correctly formulated.',
            answer: `Huffman coding builds an optimal prefix-free binary code using a greedy bottom-up tree construction:

Greedy Choice Property:
Let x and y be two characters with the lowest frequencies in alphabet C. There exists an optimal prefix code for C in which the codewords for x and y have the same length and differ only in the final bit (they are siblings at maximum depth).
Proof sketch by contradiction/exchange argument:
Suppose an optimal tree T has two other characters a and b at maximum depth. Since freq(x) <= freq(a) and freq(y) <= freq(b), swapping x with a and y with b in T cannot increase the total cost ∑ freq(c)*depth(c). Thus the modified tree T' is also optimal and contains x and y as siblings.

Optimal Substructure:
Replacing x and y with a composite node z with freq(z) = freq(x) + freq(y) reduces the problem to an alphabet of size |C| - 1. By induction, the greedy choice leads to a globally optimal tree in O(n log n) time using a min-heap.`,
        },
    ];

    for (const item of verifiedHistory) {
        const vDate = pastDate(item.weeks, 3, 2);
        const fwdDate = new Date(vDate.getTime() - 2 * HOURS_MS);
        const doubt = await upsertDoubt(`demo:doubt:${item.key}`, {
            title: item.title,
            description: `Academic doubt regarding ${item.title} in ${item.topic}.`,
            course: 'DAA',
            topic: item.topic,
            author: item.student._id,
            status: 'VERIFIED',
            assignedHelper: item.helper._id,
            tags: item.tags,
            createdAt: new Date(fwdDate.getTime() - 3 * HOURS_MS),
        });

        const answer = await upsertAnswer(`demo:answer:${item.key}`, {
            doubt: doubt._id,
            helper: item.helper._id,
            content: item.answer,
            status: 'VERIFIED',
            verifiedBy: facultyUser._id,
            verifiedAt: vDate,
            createdAt: new Date(fwdDate.getTime() - 1 * HOURS_MS),
            moderationHistory: [
                { moderator: crUser._id, action: 'FORWARDED_TO_FACULTY', createdAt: fwdDate },
                { moderator: facultyUser._id, action: 'VERIFIED', rating: item.rating, feedback: item.feedback, createdAt: vDate },
            ],
        });

        await upsertKnowledge(`demo:knowledge:${item.key}`, {
            answer: answer._id,
            doubt: doubt._id,
            verifiedBy: facultyUser._id,
            verifiedAt: vDate,
            title: item.title,
            course: 'DAA',
            topic: item.topic,
            question: doubt.description,
            answerContent: item.answer,
            tags: item.tags,
            helpfulCount: Math.floor(Math.random() * 8) + 4,
            viewCount: Math.floor(Math.random() * 30) + 20,
            status: 'ACTIVE',
        });

        await upsertModLog(`demo:modlog:cr:${item.key}`, {
            entityType: 'answer',
            entityId: answer._id,
            action: 'FORWARDED_TO_FACULTY',
            moderator: crUser._id,
            relatedEntity: doubt._id,
            relatedEntityType: 'doubt',
            createdAt: fwdDate,
        });

        await upsertModLog(`demo:modlog:faculty:${item.key}`, {
            entityType: 'answer',
            entityId: answer._id,
            action: 'VERIFIED',
            moderator: facultyUser._id,
            rating: item.rating,
            feedback: item.feedback,
            relatedEntity: doubt._id,
            relatedEntityType: 'doubt',
            createdAt: vDate,
        });

        await upsertNotification(`demo:notif:${item.key}:helper`, {
            recipient: item.helper._id,
            type: 'ANSWER_VERIFIED',
            doubt: doubt._id,
            answer: answer._id,
            message: `Your answer was verified by Dr. Neha Sharma and published to the Knowledge Library.`,
            href: `/doubts/${doubt._id}#answer-${answer._id}`,
            readAt: vDate,
        });
    }

    // 4. Two "Needs Improvement" records (status: REVISION_REQUESTED)
    const needsImp1Date = pastDate(4, 5, 2);
    const niDoubt1 = await upsertDoubt('demo:doubt:kruskal-dsu', {
        title: "Kruskal's algorithm Disjoint Set Union (DSU) time complexity",
        description: "What is the precise time complexity of Kruskal's algorithm when using Disjoint Set Union with path compression and union by rank?",
        course: 'DAA',
        topic: 'Graph Algorithms',
        author: rahulStudent._id,
        status: 'CLAIMED',
        assignedHelper: raviHelper._id,
        tags: ['graphs', 'kruskal', 'dsu', 'mst'],
        createdAt: pastDate(4, 5, 5),
    });

    const niAns1 = await upsertAnswer('demo:answer:kruskal-dsu', {
        doubt: niDoubt1._id,
        helper: raviHelper._id,
        content: `Kruskal's algorithm sorts all edges first in O(E log E) time. Then for each edge, it uses Disjoint Set Union (find and union operations) to check if adding the edge forms a cycle. With path compression and union by rank, each operation takes O(1) time. Therefore the overall complexity is O(E log E) + O(E) = O(E log E) or O(E log V).`,
        status: 'REVISION_REQUESTED',
        createdAt: pastDate(4, 5, 4),
        moderationHistory: [
            { moderator: crUser._id, action: 'FORWARDED_TO_FACULTY', createdAt: pastDate(4, 5, 3) },
            {
                moderator: facultyUser._id,
                action: 'NEEDS_IMPROVEMENT',
                rating: 3,
                feedback: 'You stated DSU operations take strictly O(1) time. Please explain the inverse Ackermann function α(V) and show that m operations take O(m α(V)), which is practically constant but mathematically distinct from O(1).',
                createdAt: needsImp1Date,
            },
        ],
    });

    await upsertModLog('demo:modlog:faculty:kruskal-dsu', {
        entityType: 'answer',
        entityId: niAns1._id,
        action: 'NEEDS_IMPROVEMENT',
        moderator: facultyUser._id,
        rating: 3,
        feedback: 'You stated DSU operations take strictly O(1) time. Please explain the inverse Ackermann function α(V).',
        relatedEntity: niDoubt1._id,
        relatedEntityType: 'doubt',
        createdAt: needsImp1Date,
    });

    await upsertNotification('demo:notif:kruskal-dsu:helper', {
        recipient: raviHelper._id,
        type: 'REVISION_REQUESTED',
        doubt: niDoubt1._id,
        answer: niAns1._id,
        message: 'Faculty requested an improvement to your answer: You stated DSU operations take strictly O(1) time. Please explain the inverse Ackermann function α(V).',
        href: `/doubts/${niDoubt1._id}#answer-${niAns1._id}`,
        readAt: needsImp1Date,
    });

    const needsImp2Date = pastDate(1, 1, 4);
    const niDoubt2 = await upsertDoubt('demo:doubt:dp-memo-tab', {
        title: 'Dynamic Programming Memoization vs Tabulation space trade-offs',
        description: 'When comparing top-down memoization and bottom-up tabulation in Dynamic Programming, does one always use strictly less memory than the other?',
        course: 'DAA',
        topic: 'Dynamic Programming',
        author: snehaStudent._id,
        status: 'CLAIMED',
        assignedHelper: arjunHelper._id,
        tags: ['dp', 'memoization', 'tabulation', 'space-complexity'],
        createdAt: pastDate(1, 1, 7),
    });

    const niAns2 = await upsertAnswer('demo:answer:dp-memo-tab', {
        doubt: niDoubt2._id,
        helper: arjunHelper._id,
        content: `Top-down memoization and bottom-up tabulation have identical space complexity because both maintain a lookup table or array of size equal to the subproblem space (e.g. O(n) for 1D, O(n*W) for 2D). Neither approach uses more memory than the other for storing answers.`,
        status: 'REVISION_REQUESTED',
        createdAt: pastDate(1, 1, 6),
        moderationHistory: [
            { moderator: crUser._id, action: 'FORWARDED_TO_FACULTY', createdAt: pastDate(1, 1, 5) },
            {
                moderator: facultyUser._id,
                action: 'NEEDS_IMPROVEMENT',
                rating: 2,
                feedback: 'Please include the recursion call-stack overhead in your comparison. Top-down memoization requires O(recursion depth) stack frames in addition to the table, whereas bottom-up tabulation requires zero recursion frames.',
                createdAt: needsImp2Date,
            },
        ],
    });

    await upsertModLog('demo:modlog:faculty:dp-memo-tab', {
        entityType: 'answer',
        entityId: niAns2._id,
        action: 'NEEDS_IMPROVEMENT',
        moderator: facultyUser._id,
        rating: 2,
        feedback: 'Please include the recursion call-stack overhead in your comparison.',
        relatedEntity: niDoubt2._id,
        relatedEntityType: 'doubt',
        createdAt: needsImp2Date,
    });

    await upsertNotification('demo:notif:dp-memo-tab:helper', {
        recipient: arjunHelper._id,
        type: 'REVISION_REQUESTED',
        doubt: niDoubt2._id,
        answer: niAns2._id,
        message: 'Faculty requested an improvement to your answer: Please include the recursion call-stack overhead in your comparison.',
        href: `/doubts/${niDoubt2._id}#answer-${niAns2._id}`,
        readAt: needsImp2Date,
    });

    // 5. Two Rejected records with reasons (status: REJECTED)
    const rej1Date = pastDate(2, 4, 1);
    const rejDoubt1 = await upsertDoubt('demo:doubt:binary-search-ll', {
        title: 'Can Binary Search be applied on singly linked lists in O(log n)?',
        description: 'If a singly linked list is sorted, can we achieve O(log n) search time by applying binary search on the nodes?',
        course: 'DAA',
        topic: 'Divide and Conquer',
        author: priyaStudent._id,
        status: 'CLAIMED',
        assignedHelper: ashishHelper._id,
        tags: ['binary-search', 'linked-list', 'divide-and-conquer'],
        createdAt: pastDate(2, 4, 4),
    });

    const rejAns1 = await upsertAnswer('demo:answer:binary-search-ll', {
        doubt: rejDoubt1._id,
        helper: ashishHelper._id,
        content: `Yes, you can apply binary search to a sorted singly linked list. Find the middle element using the slow and fast pointer approach in O(log n) time, compare the key, and recurse on the left or right half. The recurrence is T(n) = T(n/2) + O(1) = O(log n).`,
        status: 'REJECTED',
        createdAt: pastDate(2, 4, 3),
        moderationHistory: [
            { moderator: crUser._id, action: 'FORWARDED_TO_FACULTY', createdAt: pastDate(2, 4, 2) },
            {
                moderator: facultyUser._id,
                action: 'REJECTED',
                reasonCategory: 'INCORRECT',
                reason: 'Incorrect: Finding the middle node of a singly linked list requires traversing n/2 pointers, taking O(n) sequential steps. Recurrence is T(n) = T(n/2) + O(n) = O(n), so binary search cannot achieve O(log n) on a linked list.',
                rating: 1,
                feedback: 'Incorrect: Finding the middle node of a singly linked list requires traversing n/2 pointers, taking O(n) sequential steps. Recurrence is T(n) = T(n/2) + O(n) = O(n), so binary search cannot achieve O(log n) on a linked list.',
                createdAt: rej1Date,
            },
        ],
    });

    await upsertModLog('demo:modlog:faculty:binary-search-ll', {
        entityType: 'answer',
        entityId: rejAns1._id,
        action: 'REJECTED',
        moderator: facultyUser._id,
        reasonCategory: 'INCORRECT',
        reason: 'Incorrect: Finding the middle node takes O(n) sequential steps, yielding T(n) = O(n).',
        rating: 1,
        relatedEntity: rejDoubt1._id,
        relatedEntityType: 'doubt',
        createdAt: rej1Date,
    });

    await upsertNotification('demo:notif:binary-search-ll:helper', {
        recipient: ashishHelper._id,
        type: 'ANSWER_REJECTED',
        doubt: rejDoubt1._id,
        answer: rejAns1._id,
        message: 'Your answer was rejected. Incorrect: Finding the middle node of a singly linked list takes O(n), so binary search cannot achieve O(log n).',
        href: `/doubts/${rejDoubt1._id}#answer-${rejAns1._id}`,
        readAt: rej1Date,
    });

    const rej2Date = pastDate(0, 3, 5);
    const rejDoubt2 = await upsertDoubt('demo:doubt:prims-directed', {
        title: "Is Prim's algorithm guaranteed to find Minimum Spanning Tree on directed graphs?",
        description: "Does Prim's algorithm work unchanged for finding a minimum spanning tree in a directed weighted graph?",
        course: 'DAA',
        topic: 'Graph Algorithms',
        author: rahulStudent._id,
        status: 'CLAIMED',
        assignedHelper: raviHelper._id,
        tags: ['graphs', 'prims', 'mst', 'directed-graphs'],
        createdAt: pastDate(0, 3, 8),
    });

    const rejAns2 = await upsertAnswer('demo:answer:prims-directed', {
        doubt: rejDoubt2._id,
        helper: raviHelper._id,
        content: `Yes, Prim's algorithm works for directed graphs as long as you start from a root vertex that has directed paths to all other vertices. The cut property holds in directed graphs identically to undirected graphs.`,
        status: 'REJECTED',
        createdAt: pastDate(0, 3, 7),
        moderationHistory: [
            { moderator: crUser._id, action: 'FORWARDED_TO_FACULTY', createdAt: pastDate(0, 3, 6) },
            {
                moderator: facultyUser._id,
                action: 'REJECTED',
                reasonCategory: 'INCORRECT',
                reason: "Incorrect: The cut property does not hold for directed graphs (Arborescence / Minimum Spanning Tree). A directed MST is known as an Optimum Branching and requires Edmonds' algorithm (Chu-Liu/Edmonds algorithm). Prim's algorithm can get trapped in a non-optimal cycle or fail to reach nodes.",
                rating: 1,
                feedback: "Incorrect: The cut property does not hold for directed graphs. Directed minimum spanning trees require Edmonds' algorithm (Chu-Liu/Edmonds algorithm).",
                createdAt: rej2Date,
            },
        ],
    });

    await upsertModLog('demo:modlog:faculty:prims-directed', {
        entityType: 'answer',
        entityId: rejAns2._id,
        action: 'REJECTED',
        moderator: facultyUser._id,
        reasonCategory: 'INCORRECT',
        reason: "Incorrect: Prim's cut property does not hold for directed graphs. Requires Chu-Liu/Edmonds algorithm.",
        rating: 1,
        relatedEntity: rejDoubt2._id,
        relatedEntityType: 'doubt',
        createdAt: rej2Date,
    });

    await upsertNotification('demo:notif:prims-directed:helper', {
        recipient: raviHelper._id,
        type: 'ANSWER_REJECTED',
        doubt: rejDoubt2._id,
        answer: rejAns2._id,
        message: "Your answer was rejected. Incorrect: Prim's algorithm does not work on directed graphs. Directed MST requires Edmonds' algorithm.",
        href: `/doubts/${rejDoubt2._id}#answer-${rejAns2._id}`,
        readAt: rej2Date,
    });

    // 6. Two first-level review rejections by CR Aman Gupta
    const crRej1Date = pastDate(3, 2, 2);
    const crRejDoubt1 = await upsertDoubt('demo:doubt:stack-queue-cr', {
        title: 'Best way to implement Stack using single Queue',
        description: 'How can you implement a LIFO Stack using only one FIFO Queue?',
        course: 'DAA',
        topic: 'Complexity',
        author: snehaStudent._id,
        status: 'CLAIMED',
        assignedHelper: raviHelper._id,
        tags: ['stack', 'queue', 'data-structures'],
        createdAt: pastDate(3, 2, 5),
    });

    const crRejAns1 = await upsertAnswer('demo:answer:stack-queue-cr', {
        doubt: crRejDoubt1._id,
        helper: raviHelper._id,
        content: `Just pop everything and push it back bro. It takes O(1) time.`,
        status: 'REJECTED',
        createdAt: pastDate(3, 2, 4),
        moderationHistory: [
            {
                moderator: crUser._id,
                action: 'REJECTED',
                reason: 'Spam or inappropriate content: Trivial unhelpful answer that fails to specify the rotation algorithm or correct O(n) push cost.',
                createdAt: crRej1Date,
            },
        ],
    });

    await upsertModLog('demo:modlog:cr:stack-queue-cr', {
        entityType: 'answer',
        entityId: crRejAns1._id,
        action: 'REJECTED',
        moderator: crUser._id,
        reason: 'Spam or inappropriate content: Trivial unhelpful answer that fails to specify the rotation algorithm.',
        relatedEntity: crRejDoubt1._id,
        relatedEntityType: 'doubt',
        createdAt: crRej1Date,
    });

    const crRej2Date = pastDate(1, 4, 3);
    const crRejDoubt2 = await upsertDoubt('demo:doubt:strassen-cr', {
        title: "Strassen's matrix multiplication subproblems and recurrence",
        description: "How does Strassen's matrix multiplication reduce the standard O(n^3) matrix multiplication to sub-cubic time?",
        course: 'DAA',
        topic: 'Divide and Conquer',
        author: priyaStudent._id,
        status: 'CLAIMED',
        assignedHelper: arjunHelper._id,
        tags: ['strassens', 'matrix-multiplication', 'divide-and-conquer'],
        createdAt: pastDate(1, 4, 6),
    });

    const crRejAns2 = await upsertAnswer('demo:answer:strassen-cr', {
        doubt: crRejDoubt2._id,
        helper: arjunHelper._id,
        content: `Strassen's algorithm divides two n x n matrices into 2 x 2 blocks and multiplies them using fewer multiplications than the naive 8 multiplications.`,
        status: 'REJECTED',
        createdAt: pastDate(1, 4, 5),
        moderationHistory: [
            {
                moderator: crUser._id,
                action: 'REJECTED',
                reason: 'Incomplete: Missing the 7 recursive multiplication formulas (M1-M7), the recurrence T(n) = 7T(n/2) + O(n^2), and the derivation of O(n^log2(7)) ≈ O(n^2.807).',
                createdAt: crRej2Date,
            },
        ],
    });

    await upsertModLog('demo:modlog:cr:strassen-cr', {
        entityType: 'answer',
        entityId: crRejAns2._id,
        action: 'REJECTED',
        moderator: crUser._id,
        reason: 'Incomplete: Missing the 7 recursive multiplication formulas and recurrence derivation.',
        relatedEntity: crRejDoubt2._id,
        relatedEntityType: 'doubt',
        createdAt: crRej2Date,
    });

    // STEP 2B: LIVE-DEMO STAGING
    // 1. Stage 2 PENDING answers for Dr. Neha Sharma's Verification queue (status: FACULTY_PENDING)
    // Staged 1: GOOD answer to "How do we avoid the worst case in quicksort using random pivot?" (User will Verify live)
    const stage1Doubt = await upsertDoubt('demo:stage:doubt-quicksort-random', {
        title: 'How do we avoid the worst case in quicksort using random pivot?',
        description: 'In regular quicksort with a fixed first or last element pivot, sorted or nearly sorted arrays degrade the runtime to O(n²). How exactly does randomized pivot selection prevent an adversary or presorted input from hitting this worst case, and what is the expected time complexity?',
        course: 'DAA',
        topic: 'Complexity',
        author: priyaStudent._id,
        status: 'ANSWERED',
        assignedHelper: arjunHelper._id,
        tags: ['quicksort', 'randomized-algorithms', 'divide-and-conquer', 'complexity'],
        createdAt: pastDate(0, 0, 4),
    });

    const stage1AnswerContent = `Randomized QuickSort avoids worst-case O(n²) behavior by breaking any dependency on the input array's initial order. Instead of choosing a deterministic pivot (like index 0 or n-1), we select an index uniformly at random from [low, high] and swap it with the pivot position before partitioning.

Key reasons this prevents the O(n²) worst case:
1. Input independence: No specific input sequence (e.g., already sorted, reverse sorted, or pipe-organ) can reliably trigger the 0 : n-1 partition split.
2. Probabilistic guarantee: To get O(n²), the algorithm would have to randomly pick the absolute minimum or maximum element at almost every recursive step. The probability of this happening on an array of size n is 2^n / n!, which approaches 0 rapidly as n grows.
3. Expected time complexity: The expected number of comparisons is E[C] = 2n ln(n) + O(n) = O(n log n) for ALL inputs. The worst case remains theoretically O(n²) but occurs with vanishingly small probability (~0 in practice).`;

    await upsertAnswer('demo:stage:answer-quicksort-random', {
        doubt: stage1Doubt._id,
        helper: arjunHelper._id,
        content: stage1AnswerContent,
        status: 'FACULTY_PENDING',
        demoReputationAwarded: false,
        createdAt: pastDate(0, 0, 3),
        moderationHistory: [
            {
                moderator: crUser._id,
                action: 'FORWARDED_TO_FACULTY',
                createdAt: pastDate(0, 0, 2),
            },
        ],
    });

    // Staged 2: WEAK answer to "Why is merge sort stable?" (User will Reject / mark Needs Improvement live)
    const stage2Doubt = await upsertDoubt('demo:stage:doubt-mergesort-stability', {
        title: 'Why is merge sort stable?',
        description: 'Why is merge sort considered a stable sorting algorithm, and what specific part of the implementation guarantees stability?',
        course: 'DAA',
        topic: 'Divide and Conquer',
        author: rahulStudent._id,
        status: 'ANSWERED',
        assignedHelper: raviHelper._id,
        tags: ['mergesort', 'stability', 'sorting', 'divide-and-conquer'],
        createdAt: pastDate(0, 0, 3),
    });

    const stage2AnswerContent = `Merge sort is stable because it divides the array into two halves recursively until individual elements remain, and then recombines them in order. Any sorting algorithm that uses divide and conquer is naturally stable because the relative order of identical elements is never inverted during division.`;

    await upsertAnswer('demo:stage:answer-mergesort-weak', {
        doubt: stage2Doubt._id,
        helper: raviHelper._id,
        content: stage2AnswerContent,
        status: 'FACULTY_PENDING',
        createdAt: pastDate(0, 0, 2),
        moderationHistory: [
            {
                moderator: crUser._id,
                action: 'FORWARDED_TO_FACULTY',
                createdAt: pastDate(0, 0, 1),
            },
        ],
    });

    // 2. Stage 2 PENDING answers in CR's moderation queue (status: PENDING) for live forwarding
    const crStage1Doubt = await upsertDoubt('demo:stage:doubt-rbt-height', {
        title: 'What makes Red-Black Tree search O(log n)?',
        description: 'How do red-black tree color properties ensure that the tree height never exceeds 2 * log2(n + 1)?',
        course: 'DAA',
        topic: 'Divide and Conquer',
        author: snehaStudent._id,
        status: 'ANSWERED',
        assignedHelper: arjunHelper._id,
        tags: ['red-black-tree', 'binary-search-tree', 'complexity'],
        createdAt: pastDate(0, 0, 5),
    });

    await upsertAnswer('demo:stage:answer-rbt-pending', {
        doubt: crStage1Doubt._id,
        helper: arjunHelper._id,
        content: `Every path from the root to a leaf has the same number of black nodes (black-height bh). Because no two red nodes can appear consecutively, the longest possible path alternates Red-Black-Red-Black, having length at most 2*bh. The shortest path consists solely of black nodes of length bh. By induction on size, a subtree has at least 2^(bh) - 1 internal nodes, proving h <= 2 * log2(n + 1) = O(log n).`,
        status: 'PENDING',
        createdAt: pastDate(0, 0, 4),
        moderationHistory: [],
    });

    const crStage2Doubt = await upsertDoubt('demo:stage:doubt-knapsack-cr-pending', {
        title: 'Why does fractional knapsack use greedy while 0/1 knapsack requires DP?',
        description: 'Can someone clarify why greedy fails on 0/1 knapsack with a simple counterexample?',
        course: 'DAA',
        topic: 'Greedy',
        author: priyaStudent._id,
        status: 'ANSWERED',
        assignedHelper: raviHelper._id,
        tags: ['greedy', 'knapsack', 'counterexample'],
        createdAt: pastDate(0, 0, 3),
    });

    await upsertAnswer('demo:stage:answer-knapsack-cr-pending', {
        doubt: crStage2Doubt._id,
        helper: raviHelper._id,
        content: `In fractional knapsack, taking items with highest value-per-weight ratio is guaranteed to be optimal because you can take fractions to completely fill remaining capacity. In 0/1 knapsack, an item with high density may leave empty unused capacity that cannot be filled by smaller items. Counterexample: Capacity = 50. Item 1: wt 10, val 60 (density 6). Item 2: wt 20, val 100 (density 5). Item 3: wt 30, val 120 (density 4). Greedy picks item 1 (wt 10, val 60) + item 2 (wt 20, val 100) = wt 30, val 160 (remaining capacity 20 unused). But picking items 2 and 3 gives wt 50, val 220, which is higher!`,
        status: 'PENDING',
        createdAt: pastDate(0, 0, 2),
        moderationHistory: [],
    });

    console.log('Demo seed completed successfully!');
    const counts = {
        users: await User.countDocuments({ isDemoData: true }),
        doubts: await Doubt.countDocuments({ isDemoData: true }),
        answers: await Answer.countDocuments({ isDemoData: true }),
        knowledge: await KnowledgeEntry.countDocuments({ isDemoData: true }),
        moderationLogs: await ModerationLog.countDocuments({ isDemoData: true }),
        notifications: await Notification.countDocuments({ isDemoData: true }),
    };
    console.log('Current Demo Documents Count:', counts);
}

main()
    .catch((error) => {
        console.error('SEED_FACULTY_CR_FAILED:', error);
        process.exitCode = 1;
    })
    .finally(async () => {
        if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    });
