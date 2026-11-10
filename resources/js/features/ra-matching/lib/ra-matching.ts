import * as XLSX from 'xlsx';
import { assertXlsxFile, cellText, readAllRows } from '@/lib/workbook-file';
import type { WorkbookFile } from '@/lib/workbook-file';
import { MatchStatus } from './types';
import type {
    ICRRow,
    ICRSheet,
    ICRWorkbook,
    RAResult,
    RASheet,
    RAWorkbook,
    SkippedSheet,
    WorkbookKind,
    WorkbookOf,
} from './types';

const HEADER_SCAN_ROWS = 30;
const MAX_FILE_MB = 100;

const text = cellText;

/** Header text normalised for comparison: "S.I. #" → "si". */
const headerKey = (value: unknown): string =>
    text(value)
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');

const SI_HEADERS = new Set([
    'si',
    'sino',
    'sinumber',
    'salesinvoiceno',
    'salesinvoicenumber',
]);

const isSIHeader = (value: unknown): boolean =>
    SI_HEADERS.has(headerKey(value));

const columnsWhere = (
    headers: string[],
    predicate: (header: string) => boolean,
): number[] =>
    headers.flatMap((header, index) => (predicate(header) ? [index] : []));

function getSheet(workbook: XLSX.WorkBook, sheetName: string): XLSX.WorkSheet {
    const sheet = workbook.Sheets[sheetName];

    if (!sheet) {
        throw new Error(`Worksheet “${sheetName}” is missing.`);
    }

    return sheet;
}

export function parseRASheet(
    workbook: XLSX.WorkBook,
    sheetName: string,
): RASheet {
    const sheet = getSheet(workbook, sheetName);
    const grid = readAllRows(sheet, true);
    const headerRow = grid
        .slice(0, HEADER_SCAN_ROWS)
        .findIndex((row) =>
            row.some((value) => headerKey(value) === 'documentreference'),
        );

    if (headerRow < 0) {
        throw new Error(
            `No Document Reference header found in the first 30 rows of “${sheetName}”.`,
        );
    }

    const headers = grid[headerRow];
    const referenceColumns = columnsWhere(
        headers,
        (header) => headerKey(header) === 'documentreference',
    );
    const itemColumns = columnsWhere(
        headers,
        (header) => headerKey(header) === 'item',
    );

    if (referenceColumns.length > 1 || itemColumns.length > 1) {
        throw new Error(
            `“${sheetName}” has duplicate Document Reference or ITEM headers.`,
        );
    }

    const referenceColumn = referenceColumns[0];
    // Append ITEM beyond all existing cells, including data without a column header.
    const itemColumn =
        itemColumns[0] ??
        XLSX.utils.decode_range(sheet['!ref'] ?? 'A1').e.c + 1;

    const rows = grid.slice(headerRow + 1).flatMap((values, index) =>
        values.some((value) => text(value))
            ? [
                  {
                      rowIndex: headerRow + index + 1,
                      reference: text(values[referenceColumn]),
                      existingItem: text(values[itemColumn]),
                      values,
                  },
              ]
            : [],
    );

    if (!rows.length) {
        throw new Error(`“${sheetName}” has no RA detail rows.`);
    }

    return {
        sheetName,
        headers,
        headerRow,
        referenceColumn,
        itemColumn,
        hasItem: itemColumns.length === 1,
        rows,
    };
}

export function parseICRSheet(
    workbook: XLSX.WorkBook,
    sheetName: string,
): ICRSheet {
    const grid = readAllRows(getSheet(workbook, sheetName), true);
    const headerRow = grid
        .slice(0, HEADER_SCAN_ROWS)
        .findIndex(
            (row) =>
                row.some(isSIHeader) &&
                row.some((value) => headerKey(value) === 'code'),
        );

    if (headerRow < 0) {
        throw new Error(
            `No SI No. and CODE headers found in the first 30 rows of “${sheetName}”.`,
        );
    }

    const siColumns = columnsWhere(grid[headerRow], isSIHeader);
    const codeColumns = columnsWhere(
        grid[headerRow],
        (header) => headerKey(header) === 'code',
    );

    if (siColumns.length !== 1 || codeColumns.length !== 1) {
        throw new Error(`“${sheetName}” has duplicate SI No. or CODE headers.`);
    }

    const [siColumn] = siColumns;
    const [codeColumn] = codeColumns;

    return {
        sheetName,
        rows: grid.slice(headerRow + 1).flatMap((values, index) =>
            text(values[siColumn])
                ? [
                      {
                          si: text(values[siColumn]),
                          code: text(values[codeColumn]),
                          rowIndex: headerRow + index + 1,
                      },
                  ]
                : [],
        ),
    };
}

function parseAll<T>(
    workbook: XLSX.WorkBook,
    parse: (workbook: XLSX.WorkBook, sheetName: string) => T,
): { sheets: T[]; skippedSheets: SkippedSheet[] } {
    const sheets: T[] = [];
    const skippedSheets: SkippedSheet[] = [];

    for (const name of workbook.SheetNames) {
        try {
            sheets.push(parse(workbook, name));
        } catch (error) {
            skippedSheets.push({ name, reason: (error as Error).message });
        }
    }

    return { sheets, skippedSheets };
}

function readBook(
    bytes: ArrayBuffer,
    options: XLSX.ParsingOptions,
): XLSX.WorkBook {
    try {
        return XLSX.read(bytes, { type: 'array', ...options });
    } catch {
        throw new Error(
            'This workbook could not be read. Select a valid, unprotected .xlsx file.',
        );
    }
}

async function readRADetail(
    file: WorkbookFile,
    bytes: ArrayBuffer,
): Promise<RAWorkbook> {
    const workbook = readBook(bytes, { cellStyles: true });
    const { sheets, skippedSheets } = parseAll(workbook, parseRASheet);

    if (!sheets.length) {
        throw new Error('No sheet with Document Reference data was found.');
    }

    return {
        fileName: file.name,
        workbook,
        sourceBytes: new Uint8Array(bytes),
        sheets,
        skippedSheets,
        rows: sheets.flatMap((sheet) => sheet.rows),
    };
}

async function readICR(
    file: WorkbookFile,
    bytes: ArrayBuffer,
): Promise<ICRWorkbook> {
    // A non-month overview can contain formatting down to Excel's last row.
    // Discover headers using a bounded read before parsing monthly detail.
    const preview = readBook(bytes, { sheetRows: HEADER_SCAN_ROWS });
    const { sheets: compatible, skippedSheets } = parseAll(
        preview,
        parseICRSheet,
    );

    if (!compatible.length) {
        throw new Error('No sheet with SI No. and CODE headers was found.');
    }

    const names = compatible.map((sheet) => sheet.sheetName);
    const workbook = readBook(bytes, { sheets: names });
    const sheets = names.map((name) => parseICRSheet(workbook, name));

    return {
        fileName: file.name,
        sheets,
        skippedSheets,
        rows: sheets.flatMap((sheet): ICRRow[] => sheet.rows),
    };
}

export async function readRAWorkbook<K extends WorkbookKind>(
    file: WorkbookFile,
    kind: K,
): Promise<WorkbookOf<K>> {
    assertXlsxFile(file, MAX_FILE_MB);

    let bytes: ArrayBuffer;

    try {
        bytes = await file.arrayBuffer();
    } catch {
        throw new Error(
            'This workbook could not be read. Select a valid, unprotected .xlsx file.',
        );
    }

    const result =
        kind === 'ra'
            ? await readRADetail(file, bytes)
            : await readICR(file, bytes);

    return result as WorkbookOf<K>;
}

type LookupEntry = {
    codes: Set<string>;
    months: Set<string>;
    missingCode: boolean;
};

function buildLookups(icrSheets: ICRSheet[], selectedMonths: string[]) {
    const selected = new Set(selectedMonths);
    const primary = new Map<string, LookupEntry>();
    const fallback = new Map<string, LookupEntry>();

    for (const sheet of icrSheets) {
        const target = selected.has(sheet.sheetName) ? primary : fallback;

        for (const row of sheet.rows) {
            if (!row.si) {
                continue;
            }

            const entry = target.get(row.si) ?? {
                codes: new Set<string>(),
                months: new Set<string>(),
                missingCode: false,
            };

            entry.months.add(sheet.sheetName);

            if (row.code) {
                entry.codes.add(row.code);
            } else {
                entry.missingCode = true;
            }

            target.set(row.si, entry);
        }
    }

    return { primary, fallback };
}

/**
 * Matches RA Document References to ICR SI numbers. Selected months are
 * searched first; other compatible sheets are a fallback. Conflicting or
 * blank codes always need review and are never resolved by the fallback.
 */
export function matchRA(
    raSheet: RASheet,
    icrSheets: ICRSheet[],
    selectedMonths: string[],
): RAResult[] {
    const { primary, fallback } = buildLookups(icrSheets, selectedMonths);

    return raSheet.rows.map((row) => {
        const isFallback =
            !primary.has(row.reference) && fallback.has(row.reference);
        const entry = primary.get(row.reference) ?? fallback.get(row.reference);

        let status: MatchStatus = MatchStatus.NotMatched;
        let code = '';
        let reason = 'SI number not found anywhere in the ICR workbook.';

        if (!row.reference) {
            status = MatchStatus.NeedsReview;
            reason = 'Document Reference is blank.';
        } else if (entry) {
            if (entry.codes.size > 1) {
                status = MatchStatus.NeedsReview;
                reason = `Conflicting codes: ${[...entry.codes].join(', ')}.`;
            } else if (entry.missingCode || !entry.codes.size) {
                status = MatchStatus.NeedsReview;
                reason = 'A matching ICR row has a blank CODE.';
            } else {
                status = MatchStatus.Matched;
                code = [...entry.codes][0];
                reason = isFallback
                    ? 'Found outside selected months. ITEM will be filled from ICR CODE.'
                    : 'ITEM will be filled from ICR CODE.';
            }
        }

        return {
            ...row,
            status,
            code,
            reason,
            fallback: isFallback,
            months: entry ? [...entry.months] : [],
            outputItem:
                status === MatchStatus.Matched ? code : row.existingItem,
        };
    });
}
