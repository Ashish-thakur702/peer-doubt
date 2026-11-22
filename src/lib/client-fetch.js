'use client';

export async function fetchWithTimeout(input, init = {}, timeoutMs = 25_000) {
    const controller = new AbortController();
    const externalSignal = init.signal;
    let timedOut = false;

    const abortFromCaller = () => controller.abort(externalSignal?.reason);
    if (externalSignal?.aborted) abortFromCaller();
    else externalSignal?.addEventListener('abort', abortFromCaller, { once: true });

    const timeout = setTimeout(() => {
        timedOut = true;
        controller.abort();
    }, timeoutMs);

    try {
        return await fetch(input, { ...init, signal: controller.signal });
    } catch (error) {
        if (timedOut) {
            const timeoutError = new Error('The request took too long. Please try again.');
            timeoutError.name = 'TimeoutError';
            throw timeoutError;
        }
        throw error;
    } finally {
        clearTimeout(timeout);
        externalSignal?.removeEventListener('abort', abortFromCaller);
    }
}

export function withTimeout(promise, timeoutMs = 25_000) {
    let timer;
    return Promise.race([
        promise,
        new Promise((_, reject) => {
            timer = setTimeout(() => {
                const error = new Error('The request took too long. Please try again.');
                error.name = 'TimeoutError';
                reject(error);
            }, timeoutMs);
        }),
    ]).finally(() => clearTimeout(timer));
}
