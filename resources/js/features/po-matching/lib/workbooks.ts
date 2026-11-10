import * as XLSX from 'xlsx';
import {
    assertXlsxFile,
    cellText,
    readAllRows,
    readTopRows,
} from '@/lib/workbook-file';
import type { WorkbookFile } from '@/lib/workbook-file';
import { isPOHeader } from './matching';
import type { DeliveryResult, ParsedSheet, PoWorkbook } from './types';

const HEADER_SCAN_ROWS = 30;
const MAX_FILE_MB = 25;

export function parseSheet(
    workbook: XLSX.WorkBook,
    sheetName: string,
    columnOverride?: string,
): ParsedSheet {
    const sheet = workbook.Sheets[sheetName];
    const grid = sheet ? readAllRows(sheet) : [];
    const headerIndex = grid
        .slice(0, HEADER_SCAN_ROWS)
        .findIndex((row) => row.some(isPOHeader));

    if (headerIndex < 0) {
        throw new Error(
            `No PO No. column found in “${sheetName}”. Choose another sheet or upload a workbook with a PO No. header in its first 30 rows.`,
        );
    }

    const headers = grid[headerIndex].map(
        (header, index) => String(header).trim() || `Column ${index + 1}`,
    );

    if (new Set(headers).size !== headers.length) {
        throw new Error(
            'This sheet has duplicate column names. Give each column a unique header before uploading.',
        );
    }

    const poColumn = columnOverride ?? headers.find(isPOHeader) ?? '';

    if (!headers.includes(poColumn)) {
        throw new Error('The selected PO number column is missing.');
    }

    const rows = grid
        .slice(headerIndex + 1)
        .filter((row) => row.some((value) => cellText(value)))
        .map((row) =>
            Object.fromEntries(
                headers.map((header, index) => [header, row[index] ?? '']),
            ),
        );

    if (!rows.length) {
        throw new Error(`“${sheetName}” has no data rows.`);
    }

    return { sheetName, headers, poColumn, rows };
}

export async function readWorkbook(file: WorkbookFile): Promise<PoWorkbook> {
    assertXlsxFile(file, MAX_FILE_MB);

    let workbook: XLSX.WorkBook;

    try {
        workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    } catch {
        throw new Error(
            'This workbook could not be read. Check that it is a valid, unprotected .xlsx file.',
        );
    }

    // Only the top rows are scanned to pick the sheet, so large sheets parse once.
    const sheetName = workbook.SheetNames.find((name) =>
        readTopRows(workbook.Sheets[name], HEADER_SCAN_ROWS).some((row) =>
            row.some(isPOHeader),
        ),
    );

    if (!sheetName) {
        throw new Error(
            'No PO No. column found. Both workbooks must contain a PO No. header.',
        );
    }

    return {
        fileName: file.name,
        workbook,
        ...parseSheet(workbook, sheetName),
    };
}

export const RESULT_COLUMNS = [
    'Delivery Status',
    'Matched GR PO No.',
    'Matched Receipt No.',
];

export function resultsWorkbook(
    results: DeliveryResult[],
    headers: string[],
): XLSX.WorkBook {
    const sheet = XLSX.utils.aoa_to_sheet([
        [...headers, ...RESULT_COLUMNS],
        ...results.map((result) => [
            ...headers.map((header) => result.original[header] ?? ''),
            result.status,
            result.grPO,
            result.receiptNumbers.join(', '),
        ]),
    ]);

    sheet['!autofilter'] = { ref: sheet['!ref'] ?? 'A1' };
    sheet['!cols'] = [
        ...headers.map((header) => ({
            wch: /address|description|remarks/i.test(header)
                ? 42
                : Math.max(18, header.length + 2),
        })),
        { wch: 18 },
        { wch: 23 },
        { wch: 28 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'PO Delivery Results');

    return workbook;
}

export function exportResults(
    results: DeliveryResult[],
    headers: string[],
): void {
    XLSX.writeFile(
        resultsWorkbook(results, headers),
        'PO_Delivery_Results.xlsx',
    );
}
