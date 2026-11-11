import * as XLSX from 'xlsx';
import { MB } from '@/lib/workbook-file';
import type { DsrWorkerRequest } from './dsr-file.worker';
import { parseDsrWorkbook } from './parse-dsr';
import type { DsrReportInput, ParsedDsrFile } from './types';

const MAX_FILE_MB = 50;

export function assertDsrFile(file: Pick<File, 'name' | 'size'>): void {
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
        throw new Error('Please select the DSR export (.xlsx, .xls or .csv).');
    }

    if (file.size > MAX_FILE_MB * MB) {
        throw new Error(`Please use a file smaller than ${MAX_FILE_MB} MB.`);
    }
}

type WorkerResponse =
    | { result: ParsedDsrFile; error?: undefined }
    | { error: string; result?: undefined };

/** Parses a DSR export in a Web Worker, falling back to the main thread. */
export async function readDsrFile(file: File): Promise<ParsedDsrFile> {
    assertDsrFile(file);

    const bytes = await file.arrayBuffer();

    if (typeof Worker === 'undefined') {
        return parseDsrWorkbook(XLSX.read(bytes, { type: 'array' }));
    }

    return new Promise((resolve, reject) => {
        const worker = new Worker(
            new URL('./dsr-file.worker.ts', import.meta.url),
            { type: 'module' },
        );

        worker.onmessage = ({ data }: MessageEvent<WorkerResponse>) => {
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
                    'The file could not be read. Check that it is a DSR export from the vendor portal.',
                ),
            );
        };

        const request: DsrWorkerRequest = { bytes };
        worker.postMessage(request, [bytes]);
    });
}

/** Splits reports into request-sized batches. */
export function toBatches(
    reports: DsrReportInput[],
    perBatch: number,
): DsrReportInput[][] {
    const batches: DsrReportInput[][] = [];

    for (let i = 0; i < reports.length; i += perBatch) {
        batches.push(reports.slice(i, i + perBatch));
    }

    return batches;
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
