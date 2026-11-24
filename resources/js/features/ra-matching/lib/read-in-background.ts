import { inWorkerOrMainThread, runWorker } from '@/lib/run-worker';
import { assertXlsxFile } from '@/lib/workbook-file';
import { readRAWorkbook } from './ra-matching';
import type { WorkerRequest } from './ra-workbook.worker';
import type { WorkbookKind, WorkbookOf } from './types';

/**
 * Reads an RA or ICR workbook in a Web Worker, or on the main thread when the
 * worker cannot start.
 */
export async function readInBackground<K extends WorkbookKind>(
    file: File,
    kind: K,
): Promise<WorkbookOf<K>> {
    // Validate before copying a large file into the worker.
    assertXlsxFile(file, 100);

    return inWorkerOrMainThread(
        async () => {
            const bytes = await file.arrayBuffer();
            const request: WorkerRequest = {
                bytes,
                kind,
                name: file.name,
                size: file.size,
            };

            return runWorker<WorkbookOf<K>>(
                () =>
                    new Worker(
                        new URL('./ra-workbook.worker.ts', import.meta.url),
                        { type: 'module' },
                    ),
                request,
                [bytes],
            );
        },
        () => readRAWorkbook(file, kind),
    );
}
