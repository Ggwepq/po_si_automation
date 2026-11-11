import { router } from '@inertiajs/react';
import {
    store as storeDetail,
    summary as storeSummary,
} from '@/routes/sales/import';
import type { DsrReportInput, DsrSummaryInput } from './lib/types';

export type ImportResult = {
    reportCount: number;
    lineCount: number;
    replacedCount: number;
};

export type ImportBatch =
    | { kind: 'detail'; rows: DsrReportInput[] }
    | { kind: 'summary'; rows: DsrSummaryInput[] };

/**
 * Posts one batch and resolves with the server's import summary. Always
 * settles: a response without the summary (a server or network failure)
 * rejects instead of leaving the import waiting forever.
 */
export function postImportBatch(
    fileName: string,
    batch: ImportBatch,
): Promise<ImportResult> {
    const [url, payload] =
        batch.kind === 'summary'
            ? [
                  storeSummary().url,
                  { file_name: fileName, summaries: batch.rows },
              ]
            : [storeDetail().url, { file_name: fileName, reports: batch.rows }];

    return new Promise((resolve, reject) => {
        let summary: ImportResult | null = null;
        let failure: Error | null = null;

        router.post(url, payload, {
            preserveScroll: true,
            preserveState: true,
            onFlash: (flash) => {
                summary =
                    (flash as { importResult?: ImportResult } | undefined)
                        ?.importResult ?? null;
            },
            onError: (errors) => {
                failure = new Error(
                    Object.values(errors).slice(0, 3).join(' '),
                );
            },
            onFinish: () => {
                if (summary) {
                    resolve(summary);
                } else {
                    reject(
                        failure ??
                            new Error(
                                'The server did not accept the import. Try again, or contact the administrator if it keeps failing.',
                            ),
                    );
                }
            },
        });
    });
}
