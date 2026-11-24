import * as XLSX from 'xlsx';
import { inWorkerOrMainThread, runWorker } from '@/lib/run-worker';
import { MB } from '@/lib/workbook-file';
import type { DsrWorkerRequest } from './dsr-file.worker';
import { parseSalesWorkbook } from './parse-sales-file';
import type { DsrReportInput, DsrSummaryInput, ParsedSalesFile } from './types';

const MAX_FILE_MB = 50;

export function assertDsrFile(file: Pick<File, 'name' | 'size'>): void {
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
        throw new Error('Please select the DSR export (.xlsx, .xls or .csv).');
    }

    if (file.size > MAX_FILE_MB * MB) {
        throw new Error(`Please use a file smaller than ${MAX_FILE_MB} MB.`);
    }
}

/**
 * Parses a DSR export in a Web Worker so large files keep the page
 * responsive, or on the main thread when the worker cannot start.
 */
export async function readDsrFile(file: File): Promise<ParsedSalesFile> {
    assertDsrFile(file);

    const bytes = await file.arrayBuffer();

    return inWorkerOrMainThread(
        // Copied, not transferred, so the fallback can still read the bytes.
        () =>
            runWorker<ParsedSalesFile>(
                () =>
                    new Worker(
                        new URL('./dsr-file.worker.ts', import.meta.url),
                        { type: 'module' },
                    ),
                { bytes } satisfies DsrWorkerRequest,
            ),
        async () => parseSalesWorkbook(XLSX.read(bytes, { type: 'array' })),
    );
}

/** Splits rows into request-sized batches. */
export function toBatches<T>(rows: T[], perBatch: number): T[][] {
    const batches: T[][] = [];

    for (let i = 0; i < rows.length; i += perBatch) {
        batches.push(rows.slice(i, i + perBatch));
    }

    return batches;
}

/** Totals shown before importing a DSR Summary. */
export function summaryPreviewTotals(summaries: DsrSummaryInput[]) {
    const dates = summaries.map((s) => s.transaction_date).sort();

    return {
        rowCount: summaries.length,
        storeCount: new Set(summaries.map((s) => s.site_code)).size,
        noSalesDays: summaries.filter((s) => Number(s.total_sales) === 0)
            .length,
        totalSales: summaries.reduce(
            (sum, s) => sum + Number(s.total_sales),
            0,
        ),
        firstDate: dates[0] ?? null,
        lastDate: dates.at(-1) ?? null,
    };
}

/** Totals shown in the preview before importing. */
export function previewTotals(reports: DsrReportInput[]) {
    const dates = reports.map((r) => r.transaction_date).sort();
    const lines = reports.flatMap((r) => r.lines);

    return {
        reportCount: reports.length,
        storeCount: new Set(reports.map((r) => r.site_code)).size,
        lineCount: lines.length,
        totalSales: lines.reduce(
            (sum, line) => sum + Number(line.total_sales),
            0,
        ),
        firstDate: dates[0] ?? null,
        lastDate: dates.at(-1) ?? null,
    };
}
