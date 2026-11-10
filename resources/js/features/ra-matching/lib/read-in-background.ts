import { assertXlsxFile } from '@/lib/workbook-file';
import { readRAWorkbook } from './ra-matching';
import type { WorkerRequest } from './ra-workbook.worker';
import type { WorkbookKind, WorkbookOf } from './types';

type WorkerResponse<K extends WorkbookKind> =
    | { result: WorkbookOf<K>; error?: undefined }
    | { error: string; result?: undefined };

/** Reads an RA or ICR workbook in a Web Worker, falling back to the main thread. */
export async function readInBackground<K extends WorkbookKind>(
    file: File,
    kind: K,
): Promise<WorkbookOf<K>> {
    // Validate before copying a large file into the worker.
    assertXlsxFile(file, 100);

    if (typeof Worker === 'undefined') {
        return readRAWorkbook(file, kind);
    }

    const bytes = await file.arrayBuffer();

    return new Promise((resolve, reject) => {
        const worker = new Worker(
            new URL('./ra-workbook.worker.ts', import.meta.url),
            {
                type: 'module',
            },
        );

        worker.onmessage = ({ data }: MessageEvent<WorkerResponse<K>>) => {
            worker.terminate();

            if (data.error !== undefined) {
                reject(new Error(data.error));
            } else {
                resolve(data.result);
            }
        };

        worker.onerror = () => {
            worker.terminate();
            reject(
                new Error(
                    'The workbook could not be processed. Try a smaller workbook or reload the app.',
                ),
            );
        };

        const request: WorkerRequest = {
            bytes,
            kind,
            name: file.name,
            size: file.size,
        };
        worker.postMessage(request, [bytes]);
    });
}
