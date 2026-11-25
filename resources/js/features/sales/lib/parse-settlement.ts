import * as XLSX from 'xlsx';
import { cellText } from '@/lib/workbook-file';
import {
    companyFromSiteName,
    headerKey,
    parseDate,
    parseDecimal,
} from './parse-dsr';
import type {
    CsrStoreInput,
    DsrLineInput,
    LiquidationInput,
    ParsedClrFile,
    ParsedCsrFile,
} from './types';

/*
 * SM's half-month settlement exports from the Vendor Portal. Both are one
 * table (header row, data rows, a "Grand Total" row) with amounts as text
 * such as "1,610.48" and the period as "11/01/2026 - 11/15/2026".
 *
 * - Consolidated Sales Report (CSR_DETAIL): a row per store and item, the
 *   store as "0779-SMCo FESTIVAL MALL".
 * - Consolidated Liquidation Report (CLR_DETAIL): a row per store, grouped
 *   by "Countering Center" (the chain's head office, e.g. "8888 SVI
 *   HEADOFFICE"), which repeats the head office's amount payable, 1%
 *   withholding tax and net amount due on each of its rows.
 */

type Rows = unknown[][];

const CSR_COLUMNS = {
    vendorCode: 'vendorcode',
    vendorName: 'vendorname',
    period: 'transactiondate',
    articleCode: 'articlecode',
    description: 'description',
    barcode: 'barcode',
    uom: 'uom',
    salesQty: 'salesqty',
    vatExempt: 'vatexemptsales',
    vatable: 'vatablesales',
    total: 'totalsales',
    site: 'site',
} as const;

const CLR_COLUMNS = {
    vendorCode: 'vendorcode',
    vendorName: 'vendorname',
    center: 'counteringcenter',
    paymentTerm: 'paymentterm',
    period: 'documentdate',
    siteCode: 'sitecode',
    siteName: 'sitename',
    vatExempt: 'vatexemptsales',
    vatable: 'vatablesales',
    vat: 'vatamount',
    total: 'totalsales',
    payable: 'totalamountpayable',
    ewt: 'lessexpandedwithholdingtax',
    netDue: 'totalnetamountdue',
} as const;

type Columns<T> = Record<keyof T, number>;

function columnsOf<T extends Record<string, string>>(
    row: unknown[],
    names: T,
    marker: string,
): Columns<T> | null {
    const keys = row.map(headerKey);

    if (!keys.includes(marker)) {
        return null;
    }

    const columns = Object.fromEntries(
        Object.entries(names).map(([column, name]) => [
            column,
            keys.indexOf(name),
        ]),
    ) as Columns<T>;

    return Object.values(columns).every((i) => i >= 0) ? columns : null;
}

function sheetRows(workbook: XLSX.WorkBook, name: string): Rows {
    return XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[name], {
        header: 1,
        raw: true,
        defval: null,
    });
}

/** The kind of settlement export, judged by its header row; null for anything else. */
export function settlementKind(workbook: XLSX.WorkBook): 'csr' | 'clr' | null {
    for (const name of workbook.SheetNames) {
        for (const row of sheetRows(workbook, name).slice(0, 30)) {
            if (columnsOf(row, CLR_COLUMNS, 'counteringcenter')) {
                return 'clr';
            }

            if (columnsOf(row, CSR_COLUMNS, 'totalsaleswithvat')) {
                return 'csr';
            }
        }
    }

    return null;
}

/** "11/01/2026 - 11/15/2026" → start and end dates. */
export function parsePeriod(
    value: unknown,
): { start: string; end: string } | null {
    const [from, to] = cellText(value).split(/\s+-\s+/);
    const start = parseDate(from);
    const end = parseDate(to ?? from);

    return start && end && start <= end ? { start, end } : null;
}

/** "0779-SMCo FESTIVAL MALL" → code and name. */
export function parseSiteCell(
    value: unknown,
): { code: string; name: string } | null {
    const match = /^\s*(\w+)\s*-\s*(.+?)\s*$/.exec(cellText(value));

    return match ? { code: match[1], name: match[2] } : null;
}

/** "8888 SVI HEADOFFICE" → code, name and chain (SVI). */
export function parseCenter(value: unknown) {
    const match = /^\s*(\w+)\s+(.+?)\s*$/.exec(cellText(value));

    if (!match) {
        return null;
    }

    return {
        code: match[1],
        name: match[2],
        chain: companyFromSiteName(match[2]),
    };
}

const cents = (decimal: string | null) =>
    decimal === null ? 0 : Math.round(Number(decimal) * 100);

const money = (c: number) => (c / 100).toFixed(2);

/** A row without data but mentioning a total: the file's Grand Total. */
const isTotalRow = (row: unknown[], keyColumn: number) =>
    !cellText(row[keyColumn]) && /total/i.test(row.map(cellText).join(' '));

export function parseCsrWorkbook(workbook: XLSX.WorkBook): ParsedCsrFile {
    const stores = new Map<string, CsrStoreInput>();
    const warnings: string[] = [];

    for (const sheetName of workbook.SheetNames) {
        const rows = sheetRows(workbook, sheetName);
        let columns: Columns<typeof CSR_COLUMNS> | null = null;
        let sum = 0;

        rows.forEach((row, index) => {
            if (!columns) {
                columns = columnsOf(row, CSR_COLUMNS, 'totalsaleswithvat');
                sum = 0;

                return;
            }

            const where = `${sheetName} row ${index + 1}`;

            if (isTotalRow(row, columns.articleCode)) {
                const fileTotal = cents(parseDecimal(row[columns.total]));

                if (Math.abs(fileTotal - sum) > 1) {
                    warnings.push(
                        `${where}: the file's total (${money(fileTotal)}) differs from its rows (${money(sum)}). Check that the export is complete.`,
                    );
                }

                columns = null;

                return;
            }

            const code = cellText(row[columns.articleCode]);

            if (!code) {
                return;
            }

            const period = parsePeriod(row[columns.period]);
            const site = parseSiteCell(row[columns.site]);
            const vendorCode = cellText(row[columns.vendorCode]);
            const line: DsrLineInput = {
                article_code: code,
                description: cellText(row[columns.description]) || code,
                barcode: cellText(row[columns.barcode]) || null,
                uom: cellText(row[columns.uom]) || null,
                sales_qty: parseDecimal(row[columns.salesQty]) ?? '',
                vat_exempt_sales: parseDecimal(row[columns.vatExempt]) ?? '0',
                vatable_sales: parseDecimal(row[columns.vatable]) ?? '0',
                total_sales: parseDecimal(row[columns.total]) ?? '',
            };

            if (
                !period ||
                !site ||
                !vendorCode ||
                !line.sales_qty ||
                !line.total_sales
            ) {
                warnings.push(
                    `${where}: skipped, the period, store, quantity or sales is missing.`,
                );

                return;
            }

            sum += cents(line.total_sales);
            const key = `${vendorCode}|${site.code}|${period.start}|${period.end}`;
            const store = stores.get(key) ?? {
                vendor_code: vendorCode,
                vendor_name: cellText(row[columns.vendorName]) || vendorCode,
                site_code: site.code,
                site_name: site.name,
                company: companyFromSiteName(site.name),
                period_start: period.start,
                period_end: period.end,
                lines: [],
            };
            store.lines.push(line);
            stores.set(key, store);
        });
    }

    if (!stores.size) {
        throw new Error(
            warnings[0] ??
                'No rows were found in this Consolidated Sales Report.',
        );
    }

    return { kind: 'csr', stores: [...stores.values()], warnings };
}

export function parseClrWorkbook(workbook: XLSX.WorkBook): ParsedClrFile {
    const liquidations = new Map<string, LiquidationInput>();
    const warnings: string[] = [];

    for (const sheetName of workbook.SheetNames) {
        const rows = sheetRows(workbook, sheetName);
        let columns: Columns<typeof CLR_COLUMNS> | null = null;
        let sum = 0;

        rows.forEach((row, index) => {
            if (!columns) {
                columns = columnsOf(row, CLR_COLUMNS, 'counteringcenter');
                sum = 0;

                return;
            }

            const where = `${sheetName} row ${index + 1}`;

            if (isTotalRow(row, columns.siteCode)) {
                const fileTotal = cents(parseDecimal(row[columns.total]));

                if (Math.abs(fileTotal - sum) > 1) {
                    warnings.push(
                        `${where}: the file's total (${money(fileTotal)}) differs from its rows (${money(sum)}). Check that the export is complete.`,
                    );
                }

                columns = null;

                return;
            }

            const siteCode = cellText(row[columns.siteCode]);

            if (!siteCode) {
                return;
            }

            const center = parseCenter(row[columns.center]);
            const period = parsePeriod(row[columns.period]);
            const vendorCode = cellText(row[columns.vendorCode]);
            const payable = parseDecimal(row[columns.payable]);
            const ewt = parseDecimal(row[columns.ewt]) ?? '0';
            const netDue = parseDecimal(row[columns.netDue]);
            const total = parseDecimal(row[columns.total]);

            if (
                !center ||
                !period ||
                !vendorCode ||
                payable === null ||
                netDue === null ||
                total === null
            ) {
                warnings.push(
                    `${where}: skipped, the head office, period or amounts are missing.`,
                );

                return;
            }

            sum += cents(total);
            const key = `${vendorCode}|${center.code}|${period.start}|${period.end}`;
            const existing = liquidations.get(key);

            if (
                existing &&
                (existing.amount_payable !== payable ||
                    existing.net_due !== netDue)
            ) {
                warnings.push(
                    `${where}: ${center.name} ${period.start} to ${period.end} has a different amount payable from its first row; the first is used.`,
                );
            }

            const liquidation = existing ?? {
                vendor_code: vendorCode,
                vendor_name: cellText(row[columns.vendorName]) || vendorCode,
                center_code: center.code,
                center_name: center.name,
                chain: center.chain,
                payment_term: cellText(row[columns.paymentTerm]) || null,
                period_start: period.start,
                period_end: period.end,
                amount_payable: payable,
                ewt,
                net_due: netDue,
                stores: [],
            };
            const siteName = cellText(row[columns.siteName]) || siteCode;
            liquidation.stores.push({
                site_code: siteCode,
                site_name: siteName,
                company: companyFromSiteName(siteName),
                vat_exempt_sales: parseDecimal(row[columns.vatExempt]) ?? '0',
                vatable_sales: parseDecimal(row[columns.vatable]) ?? '0',
                vat_amount: parseDecimal(row[columns.vat]) ?? '0',
                total_sales: total,
            });
            liquidations.set(key, liquidation);
        });
    }

    if (!liquidations.size) {
        throw new Error(
            warnings[0] ??
                'No rows were found in this Consolidated Liquidation Report.',
        );
    }

    return {
        kind: 'clr',
        liquidations: [...liquidations.values()].sort(
            (a, b) =>
                b.period_start.localeCompare(a.period_start) ||
                a.center_code.localeCompare(b.center_code),
        ),
        warnings,
    };
}
