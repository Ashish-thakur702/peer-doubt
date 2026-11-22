import Link from 'next/link';
import StatusBadge from './StatusBadge';
import { formatDate } from '@/lib/format-date';

export default function DoubtCard({ doubt }) {
    const date = formatDate(doubt?.createdAt, 'Recently');

    return (
        <li className="card doubt-card overflow-hidden transition hover:border-pencil/50 hover:shadow-sm">
            <Link
                href={`/doubts/${doubt._id}`}
                className="flex items-start justify-between gap-4 p-4 focus-visible:outline-2 focus-visible:outline-pencil sm:p-5"
            >
                <div className="min-w-0">
                    <h2 className="truncate font-semibold">{doubt.title}</h2>
                    <p className="mt-0.5 text-sm text-graphite">
                        {doubt.topic} in {doubt.course}, asked {date}
                    </p>
                </div>
                <StatusBadge status={doubt.status} />
            </Link>
        </li>
    );
}
