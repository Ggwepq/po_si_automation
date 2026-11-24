import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    inWorkerOrMainThread,
    runWorker,
    WorkerUnavailableError,
} from './run-worker';

/** A stand-in Worker whose behaviour each test chooses. */
function fakeWorker(
    behave: (worker: {
        onmessage: ((e: { data: unknown }) => void) | null;
        onerror:
            | ((e: { message: string; preventDefault: () => void }) => void)
            | null;
    }) => void,
): () => Worker {
    return () => {
        const worker = {
            onmessage: null,
            onerror: null,
            terminate: vi.fn(),
            postMessage: () => queueMicrotask(() => behave(worker)),
        };

        return worker as unknown as Worker;
    };
}

const read = (createWorker: () => Worker) =>
    inWorkerOrMainThread(
        () => runWorker<string>(createWorker, {}),
        async () => 'main thread',
    );

describe('runWorker', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('returns the worker result', async () => {
        vi.stubGlobal('Worker', class {});

        await expect(
            read(
                fakeWorker((w) =>
                    w.onmessage?.({ data: { result: 'worker' } }),
                ),
            ),
        ).resolves.toBe('worker');
    });

    it('passes on errors the worker reports, without retrying', async () => {
        vi.stubGlobal('Worker', class {});

        await expect(
            read(
                fakeWorker((w) =>
                    w.onmessage?.({ data: { error: 'Not a DSR export' } }),
                ),
            ),
        ).rejects.toThrow('Not a DSR export');
    });

    it('falls back to the main thread when the worker script fails to load', async () => {
        vi.stubGlobal('Worker', class {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});

        await expect(
            read(
                fakeWorker((w) =>
                    w.onerror?.({ message: '', preventDefault: () => {} }),
                ),
            ),
        ).resolves.toBe('main thread');
    });

    it('falls back when the browser blocks the worker (e.g. Vite dev server origin)', async () => {
        vi.stubGlobal('Worker', class {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});

        await expect(
            read(() => {
                throw new Error('cannot be accessed from origin');
            }),
        ).resolves.toBe('main thread');
    });

    it('falls back when there are no Web Workers', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});

        await expect(
            runWorker(() => ({}) as Worker, {}),
        ).rejects.toBeInstanceOf(WorkerUnavailableError);
        await expect(read(() => ({}) as Worker)).resolves.toBe('main thread');
    });
});
