/**
 * The worker could not start: the browser has no Web Workers, blocked the
 * script (the Vite dev server runs on another origin than the app), or the
 * script failed to load. Callers fall back to the main thread.
 */
export class WorkerUnavailableError extends Error {}

type WorkerReply<T> =
    | { result: T; error?: undefined }
    | { error: string; result?: undefined };

/**
 * Sends one request to a fresh module worker and resolves with its result.
 * The worker is created by the caller's factory so Vite can still find and
 * bundle `new Worker(new URL('./x.worker.ts', import.meta.url))`.
 *
 * Errors the worker reports (e.g. "not a DSR export") reject with that
 * message; a worker that cannot start rejects with WorkerUnavailableError.
 */
export function runWorker<T>(
    createWorker: () => Worker,
    request: unknown,
    transfer: Transferable[] = [],
): Promise<T> {
    if (typeof Worker === 'undefined') {
        return Promise.reject(new WorkerUnavailableError('No Web Workers'));
    }

    let worker: Worker;

    try {
        worker = createWorker();
    } catch (error) {
        return Promise.reject(
            new WorkerUnavailableError((error as Error).message),
        );
    }

    return new Promise<T>((resolve, reject) => {
        worker.onmessage = ({ data }: MessageEvent<WorkerReply<T>>) => {
            worker.terminate();

            if (data.error !== undefined) {
                reject(new Error(data.error));
            } else {
                resolve(data.result);
            }
        };

        worker.onerror = (event) => {
            event.preventDefault();
            worker.terminate();
            reject(
                new WorkerUnavailableError(
                    event.message || 'The worker script failed to load',
                ),
            );
        };

        worker.postMessage(request, transfer);
    });
}

/** Runs the work in a worker, or on the main thread when no worker can start. */
export async function inWorkerOrMainThread<T>(
    inWorker: () => Promise<T>,
    onMainThread: () => Promise<T>,
): Promise<T> {
    try {
        return await inWorker();
    } catch (error) {
        if (!(error instanceof WorkerUnavailableError)) {
            throw error;
        }

        console.warn(`Reading the file on the main thread: ${error.message}`);

        return onMainThread();
    }
}
