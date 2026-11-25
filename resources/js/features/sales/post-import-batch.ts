import { router } from '@inertiajs/react';
import {
    clr as storeClr,
    csr as storeCsr,
    store as storeDetail,
    summary as storeSummary,
} from '@/routes/sales/import';
import type {
    CsrStoreInput,
    DsrReportInput,
    DsrSummaryInput,
    LiquidationInput,
} from './lib/types';

export type ImportResult = {
    reportCount: number;
    lineCount: number;
    replacedCount: number;
};

export type ImportBatch =
    | { kind: 'detail'; rows: DsrReportInput[] }
    | { kind: 'summary'; rows: DsrSummaryInput[] }
    | { kind: 'csr'; rows: CsrStoreInput[] }
    | { kind: 'clr'; rows: LiquidationInput[] };

function request(fileName: string, batch: ImportBatch): [string, object] {
    switch (batch.kind) {
        case 'summary':
            return [
                storeSummary().url,
                { file_name: fileName, summaries: batch.rows },
            ];
        case 'csr':
            return [
                storeCsr().url,
                { file_name: fileName, stores: batch.rows },
            ];
        case 'clr':
            return [
                storeClr().url,
                { file_name: fileName, liquidations: batch.rows },
            ];
        default:
            return [
                storeDetail().url,
                { file_name: fileName, reports: batch.rows },
            ];
    }
}

/**
 * Posts one batch and resolves with the server's import summary. Always
 * settles: a response without the summary (a server or network failure)
 * rejects instead of leaving the import waiting forever. The server
 * redirects back, so the page the import was started from shows the new data.
 */
export function postImportBatch(
    fileName: string,
    batch: ImportBatch,
): Promise<ImportResult> {
    const [url, payload] = request(fileName, batch);

    return new Promise((resolve, reject) => {
        let summary: ImportResult | null = null;
        let failure: Error | null = null;

        router.post(url, payload as Record<string, never>, {
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
