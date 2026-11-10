import type * as XLSX from 'xlsx';

export type RARow = {
    /** Zero-based worksheet row (Excel row number minus one). */
    rowIndex: number;
    reference: string;
    existingItem: string;
    values: string[];
};

export type RASheet = {
    sheetName: string;
    headers: string[];
    headerRow: number;
    referenceColumn: number;
    /** Zero-based column; when ITEM is absent it is the first free column. */
    itemColumn: number;
    hasItem: boolean;
    rows: RARow[];
};

export type ICRRow = {
    si: string;
    code: string;
    rowIndex: number;
};

export type ICRSheet = {
    sheetName: string;
    rows: ICRRow[];
};

export type SkippedSheet = {
    name: string;
    reason: string;
};

export type RAWorkbook = {
    fileName: string;
    workbook: XLSX.WorkBook;
    /** Original upload, patched directly on export to keep formatting. */
    sourceBytes: Uint8Array;
    sheets: RASheet[];
    skippedSheets: SkippedSheet[];
    rows: RARow[];
};

export type ICRWorkbook = {
    fileName: string;
    sheets: ICRSheet[];
    skippedSheets: SkippedSheet[];
    rows: ICRRow[];
};

export type WorkbookKind = 'ra' | 'icr';

export type WorkbookOf<K extends WorkbookKind> = K extends 'ra'
    ? RAWorkbook
    : ICRWorkbook;

export const MatchStatus = {
    Matched: 'Matched',
    NotMatched: 'Not matched',
    NeedsReview: 'Needs review',
} as const;

export type MatchStatus = (typeof MatchStatus)[keyof typeof MatchStatus];

export type RAResult = RARow & {
    status: MatchStatus;
    code: string;
    reason: string;
    /** True when the SI was found only outside the selected months. */
    fallback: boolean;
    months: string[];
    /** ITEM value written on export (ICR code when matched, else unchanged). */
    outputItem: string;
};
