import * as XLSX from 'xlsx';
import { cellText } from '@/lib/workbook-file';
import {
    companyFromSiteName,
    headerKey,
    parseDate,
    parseDecimal,
} from './parse-dsr';
import type { DsrSummaryInput, ParsedDsrSummaryFile } from './types';

/*
 * Reads SM's "DSR Summary" export (DSRS_DETAIL.xlsx): one row per vendor,
 * store and day with the official Total Sales Excl VAT, including 0.00 days,
 * ending with a "Grand Total" row. It has a "Month Of" column and no
 * Article Code, which tells it apart from the item-level DSR and the
 * DSR list export.
 */

const HEADERS = {
    vendorCode: 'vendorcode',
    vendorName: 'vendorname',
    siteCode: 'sitecode',
    siteName: 'sitename',
    date: 'transactiondate',
    total: 'totalsalesexclvat',
} as const;

type SummaryColumns = Record<keyof typeof HEADERS, number>;

function summaryHeader(row: unknown[]): SummaryColumns | null {
    const keys = row.map(headerKey);

    if (!keys.includes('monthof') || keys.includes('articlecode')) {
        return null;
    }

    const columns = Object.fromEntries(
        Object.entries(HEADERS).map(([column, name]) => [
            column,
            keys.indexOf(name),
        ]),
    ) as SummaryColumns;

    return Object.values(columns).every((index) => index >= 0) ? columns : null;
}

/** Whether the workbook is a DSR Summary export (first sheet with a header). */
export function isDsrSummaryWorkbook(workbook: XLSX.WorkBook): boolean {
    return workbook.SheetNames.some((name) =>
        sheetRows(workbook, name).some((row) => summaryHeader(row) !== null),
    );
}

function sheetRows(workbook: XLSX.WorkBook, sheetName: string): unknown[][] {
    return XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
        header: 1,
        raw: true,
        defval: null,
    });
}

const toCents = (decimal: string) => Math.round(Number(decimal) * 100);

export function parseDsrSummaryWorkbook(
    workbook: XLSX.WorkBook,
): ParsedDsrSummaryFile {
    const summaries = new Map<string, DsrSummaryInput>();
    const warnings: string[] = [];

    for (const sheetName of workbook.SheetNames) {
        const rows = sheetRows(workbook, sheetName);
        let columns: SummaryColumns | null = null;
        let cents = 0;

        for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
            const row = rows[rowIndex];

            if (!columns) {
                columns = summaryHeader(row);
                continue;
            }

            const where = `${sheetName} row ${rowIndex + 1}`;
            const siteCode = cellText(row[columns.siteCode]);

            // Only a row without a store can be the Grand Total; data rows
            // carry remarks that may mention totals.
            if (!siteCode && /total/i.test(row.map(cellText).join(' '))) {
                const fileTotal = parseDecimal(row[columns.total]);

                if (
                    fileTotal !== null &&
                    Math.abs(toCents(fileTotal) - cents) > 1
                ) {
                    warnings.push(
                        `${where}: the file's total (${(toCents(fileTotal) / 100).toFixed(2)}) differs from its rows (${(cents / 100).toFixed(2)}). Check that the export is complete.`,
                    );
                }

                columns = null;
                continue;
            }

            if (!siteCode) {
                continue;
            }

            const vendorCode = cellText(row[columns.vendorCode]);
            const date = parseDate(row[columns.date]);
            const total = parseDecimal(row[columns.total]);

            if (!vendorCode || !date || total === null) {
                warnings.push(
                    `${where}: skipped, vendor, transaction date or total sales is missing.`,
                );
                continue;
            }

            const siteName = cellText(row[columns.siteName]) || siteCode;
            const id = `${vendorCode}|${siteCode}|${date}`;

            if (summaries.has(id)) {
                warnings.push(
                    `${siteName} on ${date} appears more than once; the last row is used.`,
                );
                cents -= toCents(summaries.get(id)?.total_sales ?? '0');
            }

            cents += toCents(total);
            summaries.set(id, {
                vendor_code: vendorCode,
                vendor_name: cellText(row[columns.vendorName]) || vendorCode,
                site_code: siteCode,
                site_name: siteName,
                company: companyFromSiteName(siteName),
                transaction_date: date,
                total_sales: total,
            });
        }
    }

    if (!summaries.size) {
        throw new Error(
            warnings.length
                ? `No rows could be imported. ${warnings[0]}`
                : 'No rows were found in this DSR Summary.',
        );
    }

    return {
        kind: 'summary',
        summaries: [...summaries.values()].sort(
            (a, b) =>
                a.transaction_date.localeCompare(b.transaction_date) ||
                a.site_code.localeCompare(b.site_code),
        ),
        warnings,
    };
}
