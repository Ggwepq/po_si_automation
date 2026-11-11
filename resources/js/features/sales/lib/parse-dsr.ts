import * as XLSX from 'xlsx';
import { cellText } from '@/lib/workbook-file';
import type { DsrLineInput, DsrReportInput, ParsedDsrFile } from './types';

/*
 * Reads DSR exports from the SM Vendor Portal.
 *
 * 1. Flat layout, the portal's "Export Document" (DSR_DETAIL.xlsx): one table
 *    where every item row carries Site Code, Site Name and Transaction Date,
 *    ending with a "Grand Total" row. Values are text such as "1,146.38".
 * 2. Document layout, as on the portal's DSR detail page: label/value cells
 *    such as "Site Code & Name | [1230] SVI AURA PREMIER" above an item table.
 *    A sheet may hold several documents one after another.
 *
 * The portal's "Export List" (DSR_LIST.xlsx) has totals only and is rejected
 * with a hint to use Export Document. Headers are matched by name, not
 * position, so column order may vary. Each table's sum is checked against the
 * file's own "Grand Total" row.
 */

export const headerKey = (value: unknown) =>
    cellText(value)
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');

const COLUMNS = {
    articleCode: ['articlecode', 'articleno', 'article'],
    description: ['description', 'articledescription', 'itemdescription'],
    barcode: ['barcode', 'upc', 'ean'],
    uom: ['uom', 'unit'],
    salesQty: ['salesqty', 'salesquantity', 'qty', 'quantity'],
    vatExempt: ['vatexemptsales'],
    vatable: ['vatablesales'],
    total: ['totalsalesexclvat', 'totalsales', 'netsales', 'salesamount'],
    vendorCodeName: ['vendorcodename'],
    vendorCode: ['vendorcode'],
    vendorName: ['vendorname'],
    siteCodeName: ['sitecodename'],
    siteCode: ['sitecode'],
    siteName: ['sitename'],
    date: ['transactiondate', 'salesdate'],
    company: ['companyname', 'company'],
    status: ['datastatus'],
} as const;

type Column = keyof typeof COLUMNS;
type ColumnMap = Partial<Record<Column, number>>;
/** A vendor or store: "[code] name" in the portal. */
type Party = { code: string; name: string };

const VENDOR_LABELS = new Set<string>([
    ...COLUMNS.vendorCodeName,
    ...COLUMNS.vendorCode,
]);

const LABELS = new Set<string>([
    ...VENDOR_LABELS,
    ...COLUMNS.siteCodeName,
    ...COLUMNS.siteCode,
    ...COLUMNS.date,
    ...COLUMNS.status,
]);

function mapColumns(row: unknown[]): ColumnMap {
    const keys = row.map(headerKey);
    const map: ColumnMap = {};

    for (const [column, aliases] of Object.entries(COLUMNS) as [
        Column,
        readonly string[],
    ][]) {
        const index = aliases
            .map((alias) => keys.indexOf(alias))
            .find((i) => i >= 0);

        if (index !== undefined) {
            map[column] = index;
        }
    }

    return map;
}

const isItemHeader = (map: ColumnMap) =>
    map.articleCode !== undefined &&
    map.salesQty !== undefined &&
    map.total !== undefined;

/** "[1230] SVI AURA PREMIER" → code + name. */
export function parseSite(value: unknown): Party | null {
    const text = cellText(value);
    const match = /^\[\s*([^\]]+?)\s*\]\s*(.*)$/.exec(text);

    if (match) {
        return { code: match[1], name: match[2] || match[1] };
    }

    return text ? { code: text, name: text } : null;
}

/** Excel serial numbers, MM/DD/YYYY (the portal's format) and YYYY-MM-DD. */
export function parseDate(value: unknown): string | null {
    const pad = (n: number) => String(n).padStart(2, '0');

    if (typeof value === 'number' && value > 0) {
        const parts = XLSX.SSF.parse_date_code(value);

        return parts ? `${parts.y}-${pad(parts.m)}-${pad(parts.d)}` : null;
    }

    const text = cellText(value);
    const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(text);

    if (us) {
        return `${us[3]}-${pad(Number(us[1]))}-${pad(Number(us[2]))}`;
    }

    const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);

    return iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : null;
}

/** "1,146.38", "(12.50)" or 1146.38 → "1146.38"; null when not a number. */
export function parseDecimal(value: unknown): string | null {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? String(Number(value.toFixed(4))) : null;
    }

    let text = cellText(value).replace(/[,\s₱]/g, '');
    const negative = /^\(.*\)$/.test(text);
    text = text.replace(/[()]/g, '');

    if (!/^-?\d+(\.\d+)?$/.test(text)) {
        return null;
    }

    const normalised = String(Number(Number(text).toFixed(4)));

    return negative ? `-${normalised}` : normalised;
}

/** The chain prefix of an SM store name, e.g. "SVI AURA PREMIER" → "SVI". */
export const companyFromSiteName = (name: string) =>
    name.split(/\s+/)[0] || name;

const filled = (cell: unknown) =>
    typeof cell === 'number' || cellText(cell) !== '';

/** Value of a label cell: the next filled cell to its right, else the cell below. */
function labelValue(
    rows: unknown[][],
    rowIndex: number,
    index: number,
): unknown {
    const right = rows[rowIndex].slice(index + 1).find(filled);

    return right ?? rows[rowIndex + 1]?.[index];
}

const toCents = (decimal: string) => Math.round(Number(decimal) * 100);

const formatCents = (cents: number) => (cents / 100).toFixed(2);

/** The portal's "Export List": one totals row per store-day, without items. */
const isListHeader = (row: unknown[], map: ColumnMap) =>
    map.articleCode === undefined &&
    map.siteCode !== undefined &&
    row.some((cell) => headerKey(cell) === 'articlecount');

export function parseDsrWorkbook(workbook: XLSX.WorkBook): ParsedDsrFile {
    const reports = new Map<string, DsrReportInput & { block: number }>();
    const warnings: string[] = [];
    let block = 0;
    let sawListExport = false;

    for (const sheetName of workbook.SheetNames) {
        const rows = XLSX.utils.sheet_to_json<unknown[]>(
            workbook.Sheets[sheetName],
            {
                header: 1,
                raw: true,
                defval: null,
            },
        );

        let vendor: Party | null = null;
        let site: Party | null = null;
        let date: string | null = null;
        let status: string | null = null;
        let table: ColumnMap | null = null;
        // Sales read from the current item table, in centavos, to check
        // against the file's own "Grand Total" row.
        let tableCents = 0;

        for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
            const row = rows[rowIndex];
            const map = mapColumns(row);

            if (isItemHeader(map)) {
                table = map;
                tableCents = 0;
                block++;
                continue;
            }

            sawListExport ||= isListHeader(row, map);

            if (table) {
                const articleCode = cellText(row[table.articleCode ?? -1]);
                const isTotalRow = /total/i.test(row.map(cellText).join(' '));

                // A blank or total row ends the item table.
                if (!articleCode || isTotalRow) {
                    const fileTotal = isTotalRow
                        ? parseDecimal(row[table.total ?? -1])
                        : null;

                    if (
                        fileTotal !== null &&
                        Math.abs(toCents(fileTotal) - tableCents) > 1
                    ) {
                        warnings.push(
                            `${sheetName} row ${rowIndex + 1}: the file's total (${formatCents(toCents(fileTotal))}) differs from its item lines (${formatCents(tableCents)}). Check that the export is complete.`,
                        );
                    }

                    table = null;
                } else {
                    const line = toLine(row, table, articleCode);
                    const rowVendor =
                        table.vendorCode !== undefined
                            ? toParty(row, table.vendorCode, table.vendorName)
                            : vendor;
                    const rowSite =
                        table.siteCode !== undefined
                            ? toParty(row, table.siteCode, table.siteName)
                            : site;
                    const rowDate =
                        table.date !== undefined
                            ? parseDate(row[table.date])
                            : date;
                    const rowCompany =
                        table.company !== undefined
                            ? cellText(row[table.company])
                            : '';
                    const where = `${sheetName} row ${rowIndex + 1}`;

                    if (!line) {
                        warnings.push(
                            `${where}: skipped, quantity or sales is not a number.`,
                        );
                    } else if (!rowVendor || !rowSite || !rowDate) {
                        warnings.push(
                            `${where}: skipped, vendor, store or transaction date is missing.`,
                        );
                    } else {
                        tableCents += toCents(line.total_sales);
                        addLine(reports, warnings, block, {
                            vendor: rowVendor,
                            site: rowSite,
                            date: rowDate,
                            company:
                                rowCompany || companyFromSiteName(rowSite.name),
                            status:
                                (table.status !== undefined
                                    ? cellText(row[table.status])
                                    : '') || status,
                            line,
                        });
                    }

                    continue;
                }
            }

            // Document header labels; skip rows that look like a table header.
            if (Object.keys(map).length >= 4) {
                continue;
            }

            row.forEach((cell, index) => {
                const label = headerKey(cell);

                if (!LABELS.has(label)) {
                    return;
                }

                const value = labelValue(rows, rowIndex, index);

                if (label === 'transactiondate') {
                    date = parseDate(value) ?? date;
                } else if (label === 'datastatus') {
                    status = cellText(value) || status;
                } else if (VENDOR_LABELS.has(label)) {
                    vendor = parseSite(value) ?? vendor;
                } else {
                    site = parseSite(value) ?? site;
                }
            });
        }
    }

    if (!reports.size && sawListExport) {
        throw new Error(
            'This is the DSR list export, which only has totals per store. In the vendor portal, select the reports and use "Export Document" instead, which includes the items sold.',
        );
    }

    if (!reports.size && warnings.length) {
        throw new Error(
            `No lines could be imported. ${warnings[0]}${warnings.length > 1 ? ` (and ${warnings.length - 1} more)` : ''}`,
        );
    }

    if (!reports.size) {
        throw new Error(
            'No DSR item lines were found. The file needs an item table with Article Code, Sales Qty and Total Sales columns, plus the store and transaction date.',
        );
    }

    return {
        kind: 'detail',
        reports: [...reports.values()]
            .map(({ block: _block, ...report }) => report)
            .sort(
                (a, b) =>
                    a.transaction_date.localeCompare(b.transaction_date) ||
                    a.vendor_code.localeCompare(b.vendor_code) ||
                    a.site_code.localeCompare(b.site_code),
            ),
        warnings,
    };
}

function toParty(
    row: unknown[],
    codeColumn: number,
    nameColumn: number | undefined,
): Party | null {
    const code = cellText(row[codeColumn]);

    if (!code) {
        return null;
    }

    const name = nameColumn !== undefined ? cellText(row[nameColumn]) : '';

    return { code, name: name || code };
}

function toLine(
    row: unknown[],
    table: ColumnMap,
    articleCode: string,
): DsrLineInput | null {
    const optional = (column: Column) => {
        const index = table[column];
        const text = index === undefined ? '' : cellText(row[index]);

        return text || null;
    };
    const decimal = (column: Column) => {
        const index = table[column];

        return index === undefined ? null : parseDecimal(row[index]);
    };

    const qty = decimal('salesQty');
    const total = decimal('total');

    if (qty === null || total === null) {
        return null;
    }

    return {
        article_code: articleCode,
        description: optional('description') ?? articleCode,
        barcode: optional('barcode'),
        uom: optional('uom'),
        sales_qty: qty,
        vat_exempt_sales: decimal('vatExempt') ?? '0',
        vatable_sales: decimal('vatable') ?? total,
        total_sales: total,
    };
}

function addLine(
    reports: Map<string, DsrReportInput & { block: number }>,
    warnings: string[],
    block: number,
    entry: {
        vendor: Party;
        site: Party;
        date: string;
        company: string;
        status: string | null;
        line: DsrLineInput;
    },
): void {
    const id = `${entry.vendor.code}|${entry.site.code}|${entry.date}`;
    const existing = reports.get(id);

    if (existing && existing.block !== block) {
        // The same store-day exported twice: keep the later copy only.
        warnings.push(
            `${entry.site.name} on ${entry.date} appears more than once; the last copy is used.`,
        );
        reports.delete(id);
    }

    const report = reports.get(id) ?? {
        vendor_code: entry.vendor.code,
        vendor_name: entry.vendor.name,
        site_code: entry.site.code,
        site_name: entry.site.name,
        company: entry.company,
        transaction_date: entry.date,
        data_status: entry.status,
        lines: [],
        block,
    };

    report.lines.push(entry.line);
    reports.set(id, report);
}
