import * as XLSX from 'xlsx';

/** The subset of `File` that workbook readers need (also easy to fake in tests). */
export type WorkbookFile = {
    name: string;
    size: number;
    arrayBuffer: () => Promise<ArrayBuffer>;
};

export const MB = 1024 * 1024;

/** A cell value as trimmed text; non-primitive values count as blank. */
export function cellText(value: unknown): string {
    if (typeof value === 'string') {
        return value.trim();
    }

    return typeof value === 'number' || typeof value === 'boolean'
        ? String(value)
        : '';
}

export function assertXlsxFile(
    file: Pick<WorkbookFile, 'name' | 'size'>,
    maxMb: number,
): void {
    if (!/\.xlsx$/i.test(file.name)) {
        throw new Error('Please select an .xlsx workbook.');
    }

    if (file.size > maxMb * MB) {
        throw new Error(`Please use a workbook smaller than ${maxMb} MB.`);
    }
}

/**
 * Reads at most `limit` rows from the top of a sheet as displayed text.
 * Used to find header rows without parsing an entire (possibly huge) sheet.
 */
export function readTopRows(
    sheet: XLSX.WorkSheet | undefined,
    limit: number,
): string[][] {
    const ref = sheet?.['!ref'];

    if (!sheet || !ref) {
        return [];
    }

    const range = XLSX.utils.decode_range(ref);
    range.e.r = Math.min(range.e.r, range.s.r + limit - 1);

    return XLSX.utils.sheet_to_json<string[]>(sheet, {
        header: 1,
        raw: false,
        range,
    });
}

/**
 * Reads every row of a sheet as displayed text, with blank cells as ''.
 * With `fromA1`, row 0 of the result is Excel row 1 even when the sheet's
 * used range starts lower, so indexes map to real worksheet rows.
 */
export function readAllRows(sheet: XLSX.WorkSheet, fromA1 = false): string[][] {
    return XLSX.utils.sheet_to_json<string[]>(sheet, {
        header: 1,
        raw: false,
        defval: '',
        ...(fromA1 ? { range: 0 } : {}),
    });
}

export function downloadBytes(bytes: Uint8Array, fileName: string): void {
    const url = URL.createObjectURL(
        new Blob([bytes as BlobPart], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
