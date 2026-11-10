import type * as XLSX from 'xlsx';

/** One spreadsheet row keyed by header text; values are displayed text. */
export type SheetRow = Record<string, string>;

export type ParsedSheet = {
    sheetName: string;
    headers: string[];
    poColumn: string;
    rows: SheetRow[];
};

export type PoWorkbook = ParsedSheet & {
    fileName: string;
    workbook: XLSX.WorkBook;
};

export const DeliveryStatus = {
    Delivered: 'Delivered',
    Undelivered: 'Undelivered',
    NeedsReview: 'Needs review',
} as const;

export type DeliveryStatus =
    (typeof DeliveryStatus)[keyof typeof DeliveryStatus];

export type DeliveryResult = {
    id: number;
    original: SheetRow;
    poNumber: string;
    grPO: string;
    receiptNumbers: string[];
    vendorCode: string;
    vendorName: string;
    status: DeliveryStatus;
};

export type DeliverySummary = {
    /** Unique non-blank PO numbers in the PO upload. */
    total: number;
    delivered: number;
    undelivered: number;
    /** Item rows with a blank PO number. */
    review: number;
    /** PO numbers present in GR but absent from the PO upload. */
    unmatchedGR: number;
};
