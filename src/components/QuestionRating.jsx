'use client';
import { fetchWithTimeout } from '@/lib/client-fetch';

import { useState } from 'react';

export default function QuestionRating(props) {
    const { doubtId, average = 0, count = 0, currentRating = 0 } = props;
    return <RatingWidget key={`${doubtId}:${average}:${count}:${currentRating}`} {...props} />;
}

function RatingWidget({
    doubtId,
    average = 0,
    count = 0,
    currentRating = 0,
    canRate = true,
    disabledReason = 'You cannot rate your own question.',
}) {
    const [rating, setRating] = useState(Number(currentRating) || 0);
    const [summary, setSummary] = useState({
        average: Number.isFinite(Number(average)) ? Number(average) : 0,
        count: Number.isFinite(Number(count)) ? Math.max(0, Number(count)) : 0,
    });
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');

    async function submit(value) {
        const previousRating = rating;
        const previousSummary = summary;
        const nextCount = rating ? summary.count : summary.count + 1;
        const nextTotal = summary.average * summary.count - (rating || 0) + value;
        setRating(value);
        setSummary({
            count: nextCount,
            average: Number((nextTotal / nextCount).toFixed(2)),
        });
        setBusy(true);
        setMessage('');
        try {
            const response = await fetchWithTimeout(`/api/doubts/${doubtId}/rating`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rating: value }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.msg || 'Could not save your rating.');
            setRating(data.rating);
            setSummary({
                average: Number.isFinite(Number(data.average)) ? Number(data.average) : 0,
                count: Number.isFinite(Number(data.count)) ? Math.max(0, Number(data.count)) : 0,
            });
            setMessage('Your rating is saved. You can update it any time.');
        } catch (error) {
            setRating(previousRating);
            setSummary(previousSummary);
            setMessage(error.message);
        } finally {
            setBusy(false);
        }
    }

    return (
        <section className="rounded-xl bg-paper p-4" aria-label="Question rating">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <p className="text-sm font-semibold">Rate this question</p>
                    <p className="mt-1 text-xs text-graphite">
                        {summary.count ? `${summary.average.toFixed(1)} out of 5 · ${summary.count} ${summary.count === 1 ? 'rating' : 'ratings'}` : 'No ratings yet'}
                    </p>
                </div>
                <div role="group" aria-label="Choose a rating from 1 to 5 stars" className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((value) => (
                        <button
                            key={value}
                            type="button"
                            className="rounded p-1 text-2xl leading-none text-pencil transition hover:scale-110 disabled:cursor-not-allowed disabled:opacity-50"
                            onClick={() => submit(value)}
                            disabled={!canRate || busy}
                            aria-label={`${value} ${value === 1 ? 'star' : 'stars'}`}
                            aria-pressed={rating === value}
                            title={!canRate ? disabledReason : `Rate ${value} ${value === 1 ? 'star' : 'stars'}`}
                        >
                            {value <= rating ? '★' : '☆'}
                        </button>
                    ))}
                </div>
            </div>
            {message && <p className="mt-2 text-xs text-graphite" role="status">{message}</p>}
            {!canRate && <p className="mt-2 text-xs text-graphite">{disabledReason}</p>}
        </section>
    );
}
