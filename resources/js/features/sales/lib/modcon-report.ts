import { cellRef, columnName, excelDate, writeXlsx } from '@/lib/xlsx-writer';
import type { Cell, CellStyle, SheetSpec } from '@/lib/xlsx-writer';
import type { ModconSummary } from './types';

/*
 * The ModCon (consignment) report workbook, as in MODCON SALES REPORT.xlsx:
 * one sheet per SM store chain (SSM, SVI, SMCO) with each item's sales and
 * quantity for every half-month of the year, the year's AMOUNT, 12% VAT,
 * TOTAL AMOUNT and TOTAL QTY, and rows for the S.I. and R.A. numbers; a
 * TOTAL PER COMPANY sheet adding the chains up; and, for a monthly report,
 * the month's sheet. Totals are Excel formulas, as in the original.
 */

const VAT_RATE = 0.12;
const HALVES = 24;
const PESO =
    '_-[$₱-464]* #,##0.00_-;\\-[$₱-464]* #,##0.00_-;_-[$₱-464]* "-"??_-;_-@_-';
const FONT = 'Aptos Narrow';
const YELLOW = 'FFFF00';
const BLUE = '00B0F0';
const TOTAL_FILL = 'DCE6F1';
const MONTHS = [
    'JANUARY',
    'FEBRUARY',
    'MARCH',
    'APRIL',
    'MAY',
    'JUNE',
    'JULY',
    'AUGUST',
    'SEPTEMBER',
    'OCTOBER',
    'NOVEMBER',
    'DECEMBER',
];
export const TOTAL_SHEET = 'TOTAL PER COMPANY';

const thin = {
    left: 'thin',
    right: 'thin',
    top: 'thin',
    bottom: 'thin',
} as const;
const thick = {
    left: 'thick',
    right: 'thick',
    top: 'thick',
    bottom: 'thick',
} as const;

const STYLE = {
    title: {
        font: { name: FONT, size: 14, bold: true },
        align: { horizontal: 'center' },
    },
    period: {
        font: { name: FONT, size: 11 },
        fill: YELLOW,
        border: thick,
        align: { horizontal: 'center' },
        numFmt: 'd-mmm',
    },
    heading: {
        font: { name: FONT, size: 14, bold: true },
        fill: YELLOW,
        border: thick,
        align: { horizontal: 'center' },
    },
    banner: {
        font: { name: FONT, size: 14, bold: true },
        fill: BLUE,
        border: thin,
        align: { horizontal: 'center' },
    },
    item: {
        font: { name: FONT, size: 14, bold: true },
        border: thin,
        align: { horizontal: 'right' },
    },
    rowLabel: {
        font: { name: FONT, size: 14, bold: true },
        fill: YELLOW,
        border: thin,
        align: { horizontal: 'right' },
    },
    amount: { font: { name: FONT, size: 11 }, border: thin, numFmt: PESO },
    qty: {
        font: { name: FONT, size: 11 },
        border: thin,
        align: { horizontal: 'center' },
    },
    entry: {
        font: { name: FONT, size: 11 },
        border: thin,
        align: { horizontal: 'center' },
    },
    totalAmount: {
        font: { name: FONT, size: 12, bold: true },
        fill: TOTAL_FILL,
        border: thin,
        numFmt: PESO,
    },
    totalQty: {
        font: { name: FONT, size: 12, bold: true },
        fill: TOTAL_FILL,
        border: thin,
        align: { horizontal: 'center' },
    },
    grandAmount: {
        font: { name: FONT, size: 14, bold: true },
        fill: YELLOW,
        border: thin,
        numFmt: PESO,
    },
    grandQty: {
        font: { name: FONT, size: 14, bold: true },
        fill: YELLOW,
        border: thin,
        align: { horizontal: 'center' },
    },
} satisfies Record<string, CellStyle>;

/** Rows of every ModCon sheet (0-based). */
const ROW = { title: 1, header: 3, banner: 4, firstItem: 5 };

const amountColumn = (half: number) => 1 + half * 2;
const qtyColumn = (half: number) => 2 + half * 2;
const YEAR_AMOUNT = amountColumn(HALVES);
const YEAR_VAT = YEAR_AMOUNT + 1;
const YEAR_TOTAL = YEAR_AMOUNT + 2;
const YEAR_QTY = YEAR_AMOUNT + 3;

const round = (value: number, decimals: number) =>
    Number(value.toFixed(decimals));
const sum = (values: number[], decimals: number) =>
    round(
        values.reduce((a, b) => a + b, 0),
        decimals,
    );

/** Last day of the half: the 15th, or the month's last day. */
function halfEnd(year: number, half: number): string {
    const month = Math.floor(half / 2) + 1;
    const day = half % 2 === 0 ? 15 : new Date(year, month, 0).getDate();

    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

const ref = (sheet: string, row: number, column: number) =>
    `'${sheet}'!${cellRef(row, column)}`;

class Sheet {
    readonly spec: SheetSpec;

    constructor(name: string) {
        this.spec = {
            name,
            cells: new Map(),
            rowHeights: new Map(),
            columnWidths: new Map(),
            merges: [],
            frozenColumns: 1,
            zoom: 80,
        };
    }

    set(row: number, column: number, cell: Cell): void {
        if (!this.spec.cells.has(row)) {
            this.spec.cells.set(row, new Map());
        }

        this.spec.cells.get(row)?.set(column, cell);
    }

    /** The company row above the items, with empty bordered cells across. */
    banner(company: string, lastColumn: number): void {
        this.set(ROW.banner, 0, {
            value: company.toUpperCase(),
            style: STYLE.banner,
        });
        for (let c = 1; c <= lastColumn; c++) {
            this.set(ROW.banner, c, { style: STYLE.entry });
        }
        this.spec.rowHeights?.set(ROW.banner, 18.6);
    }

    title(text: string, lastColumn: number, size = 14): void {
        this.set(ROW.title, 0, {
            value: text,
            style: { ...STYLE.title, font: { ...STYLE.title.font, size } },
        });
        this.spec.merges?.push(
            `A${ROW.title + 1}:${columnName(lastColumn)}${ROW.title + 1}`,
        );
        this.spec.rowHeights?.set(ROW.title, size > 14 ? 23.4 : 18);
    }
}

type Grid = { amount: number[][]; qty: number[][] };

/**
 * A chain's sheet, or TOTAL PER COMPANY when `sources` names the chain
 * sheets to add up (each cell is then a formula over them).
 */
function yearSheet(
    name: string,
    title: string,
    company: string,
    summary: ModconSummary,
    grid: Grid,
    sources?: string[],
): SheetSpec {
    const sheet = new Sheet(name);
    const items = summary.items;
    const totalRow = ROW.firstItem + items.length;

    sheet.title(title, 34);
    sheet.spec.columnWidths?.set(0, 38.7);
    for (let h = 0; h < HALVES; h++) {
        sheet.spec.columnWidths?.set(amountColumn(h), 14);
        sheet.spec.columnWidths?.set(qtyColumn(h), 7.6);
        sheet.set(ROW.header, amountColumn(h), {
            value: excelDate(halfEnd(summary.year, h)),
            style: STYLE.period,
        });
        sheet.set(ROW.header, qtyColumn(h), {
            value: 'QTY',
            style: STYLE.period,
        });
    }
    [
        ['AMOUNT', 17],
        ['VAT', 15.6],
        ['TOTAL AMOUNT', 19],
        ['TOTAL  QTY', 8.9],
    ].forEach(([label, width], i) => {
        sheet.set(ROW.header, YEAR_AMOUNT + i, {
            value: label,
            style: STYLE.heading,
        });
        sheet.spec.columnWidths?.set(YEAR_AMOUNT + i, width as number);
    });
    sheet.spec.rowHeights?.set(ROW.header, 19.2);
    sheet.banner(company, YEAR_QTY);

    const cell = (
        row: number,
        column: number,
        value: number,
        style: CellStyle,
    ): Cell =>
        sources
            ? {
                  formula: sources.map((s) => ref(s, row, column)).join('+'),
                  value,
                  style,
              }
            : { value: value === 0 ? null : value, style };

    items.forEach((item, i) => {
        const r = ROW.firstItem + i;
        const amounts = grid.amount[i] ?? [];
        const quantities = grid.qty[i] ?? [];
        const yearAmount = sum(amounts, 2);

        sheet.set(r, 0, { value: item.description, style: STYLE.item });
        for (let h = 0; h < HALVES; h++) {
            sheet.set(
                r,
                amountColumn(h),
                cell(r, amountColumn(h), amounts[h] ?? 0, STYLE.amount),
            );
            sheet.set(
                r,
                qtyColumn(h),
                cell(r, qtyColumn(h), quantities[h] ?? 0, STYLE.qty),
            );
        }
        const across = (column: (h: number) => number) =>
            `SUM(${Array.from({ length: HALVES }, (_, h) => cellRef(r, column(h))).join(',')})`;
        sheet.set(r, YEAR_AMOUNT, {
            formula: across(amountColumn),
            value: yearAmount,
            style: STYLE.amount,
        });
        sheet.set(r, YEAR_VAT, {
            formula: `${cellRef(r, YEAR_AMOUNT)}*${VAT_RATE}`,
            value: round(yearAmount * VAT_RATE, 2),
            style: STYLE.amount,
        });
        sheet.set(r, YEAR_TOTAL, {
            formula: `${cellRef(r, YEAR_AMOUNT)}+${cellRef(r, YEAR_VAT)}`,
            value: round(yearAmount * (1 + VAT_RATE), 2),
            style: STYLE.amount,
        });
        sheet.set(r, YEAR_QTY, {
            formula: across(qtyColumn),
            value: sum(quantities, 3),
            style: STYLE.qty,
        });
        sheet.spec.rowHeights?.set(r, 18);
    });

    const down = (column: number) =>
        items.length
            ? `SUM(${cellRef(ROW.firstItem, column)}:${cellRef(totalRow - 1, column)})`
            : '0';
    const columnTotal = (
        column: number,
        values: number[],
        decimals: number,
    ) => ({ formula: down(column), value: sum(values, decimals) });

    sheet.set(totalRow, 0, { value: 'TOTAL', style: STYLE.rowLabel });
    for (let h = 0; h < HALVES; h++) {
        sheet.set(totalRow, amountColumn(h), {
            ...columnTotal(
                amountColumn(h),
                grid.amount.map((a) => a[h] ?? 0),
                2,
            ),
            style: STYLE.totalAmount,
        });
        sheet.set(totalRow, qtyColumn(h), {
            ...columnTotal(
                qtyColumn(h),
                grid.qty.map((q) => q[h] ?? 0),
                3,
            ),
            style: STYLE.totalQty,
        });
    }
    const yearAmounts = grid.amount.map((a) => sum(a, 2));
    sheet.set(totalRow, YEAR_AMOUNT, {
        ...columnTotal(YEAR_AMOUNT, yearAmounts, 2),
        style: STYLE.grandAmount,
    });
    sheet.set(totalRow, YEAR_VAT, {
        ...columnTotal(
            YEAR_VAT,
            yearAmounts.map((a) => round(a * VAT_RATE, 2)),
            2,
        ),
        style: STYLE.grandAmount,
    });
    sheet.set(totalRow, YEAR_TOTAL, {
        ...columnTotal(
            YEAR_TOTAL,
            yearAmounts.map((a) => round(a * (1 + VAT_RATE), 2)),
            2,
        ),
        style: STYLE.grandAmount,
    });
    sheet.set(totalRow, YEAR_QTY, {
        ...columnTotal(
            YEAR_QTY,
            grid.qty.map((q) => sum(q, 3)),
            3,
        ),
        style: STYLE.grandQty,
    });
    sheet.spec.rowHeights?.set(totalRow, 18);

    // Filled in by hand once SM's invoice and remittance are known.
    ['S.I NUMBER', 'R.A NUMBER', 'R.A AMOUNT'].forEach((label, i) => {
        const r = totalRow + 1 + i;
        sheet.set(r, 0, { value: label, style: STYLE.rowLabel });
        for (let c = 1; c <= YEAR_QTY; c++) {
            sheet.set(r, c, {
                style:
                    label === 'R.A AMOUNT' && c % 2 === 1
                        ? STYLE.amount
                        : STYLE.entry,
            });
        }
        sheet.spec.rowHeights?.set(r, 18);
    });

    return sheet.spec;
}

/** The month's sheet: both halves and the month's total, from TOTAL PER COMPANY. */
function monthSheet(
    company: string,
    summary: ModconSummary,
    month: number,
    totals: Grid,
): SheetSpec {
    const sheet = new Sheet(MONTHS[month]);
    const halves = [month * 2, month * 2 + 1];
    const totalRow = ROW.firstItem + summary.items.length;

    sheet.title(`${company.toUpperCase()} SALES REPORT ${summary.year}`, 6, 18);
    [33.7, 12.8, 7.2, 15.3, 8, 17, 13.4].forEach((w, c) =>
        sheet.spec.columnWidths?.set(c, w),
    );
    halves.forEach((h, i) => {
        sheet.set(ROW.header, 1 + i * 2, {
            value: excelDate(halfEnd(summary.year, h)),
            style: STYLE.period,
        });
        sheet.set(ROW.header, 2 + i * 2, { value: 'QTY', style: STYLE.period });
    });
    sheet.set(ROW.header, 5, {
        value: 'TOTAL ',
        style: { ...STYLE.period, font: { name: FONT, size: 11, bold: true } },
    });
    sheet.set(ROW.header, 6, {
        value: 'TOTAL  QTY',
        style: { ...STYLE.period, font: { name: FONT, size: 11, bold: true } },
    });
    sheet.banner(company, 6);

    summary.items.forEach((item, i) => {
        const r = ROW.firstItem + i;
        const amounts = halves.map((h) => totals.amount[i]?.[h] ?? 0);
        const quantities = halves.map((h) => totals.qty[i]?.[h] ?? 0);

        sheet.set(r, 0, { value: item.description, style: STYLE.item });
        halves.forEach((h, k) => {
            sheet.set(r, 1 + k * 2, {
                formula: ref(TOTAL_SHEET, r, amountColumn(h)),
                value: amounts[k],
                style: STYLE.amount,
            });
            sheet.set(r, 2 + k * 2, {
                formula: ref(TOTAL_SHEET, r, qtyColumn(h)),
                value: quantities[k],
                style: STYLE.qty,
            });
        });
        sheet.set(r, 5, {
            formula: `SUM(${cellRef(r, 1)},${cellRef(r, 3)})`,
            value: sum(amounts, 2),
            style: STYLE.amount,
        });
        sheet.set(r, 6, {
            formula: `SUM(${cellRef(r, 2)},${cellRef(r, 4)})`,
            value: sum(quantities, 3),
            style: STYLE.qty,
        });
        sheet.spec.rowHeights?.set(r, 18);
    });

    const down = (
        column: number,
        values: number[],
        decimals: number,
        style: CellStyle,
    ): Cell => ({
        formula: summary.items.length
            ? `SUM(${cellRef(ROW.firstItem, column)}:${cellRef(totalRow - 1, column)})`
            : '0',
        value: sum(values, decimals),
        style,
    });
    const column = (k: number, of: 'amount' | 'qty') =>
        summary.items.map((_, i) => totals[of][i]?.[halves[k]] ?? 0);

    sheet.set(totalRow, 0, { value: 'TOTAL', style: STYLE.rowLabel });
    sheet.set(totalRow, 1, down(1, column(0, 'amount'), 2, STYLE.totalAmount));
    sheet.set(totalRow, 2, down(2, column(0, 'qty'), 3, STYLE.totalQty));
    sheet.set(totalRow, 3, down(3, column(1, 'amount'), 2, STYLE.totalAmount));
    sheet.set(totalRow, 4, down(4, column(1, 'qty'), 3, STYLE.totalQty));
    sheet.set(
        totalRow,
        5,
        down(
            5,
            [...column(0, 'amount'), ...column(1, 'amount')],
            2,
            STYLE.grandAmount,
        ),
    );
    sheet.set(
        totalRow,
        6,
        down(6, [...column(0, 'qty'), ...column(1, 'qty')], 3, STYLE.grandQty),
    );

    return sheet.spec;
}

/** Adds the chains' grids cell by cell. */
function addUp(summary: ModconSummary): Grid {
    const zero = () => summary.items.map(() => Array<number>(HALVES).fill(0));
    const grid: Grid = { amount: zero(), qty: zero() };

    for (const chain of summary.chains) {
        summary.items.forEach((_, i) => {
            for (let h = 0; h < HALVES; h++) {
                grid.amount[i][h] = round(
                    grid.amount[i][h] + (chain.amount[i]?.[h] ?? 0),
                    2,
                );
                grid.qty[i][h] = round(
                    grid.qty[i][h] + (chain.qty[i]?.[h] ?? 0),
                    3,
                );
            }
        });
    }

    return grid;
}

/**
 * Builds the ModCon workbook. `month` (0–11) adds that month's sheet first,
 * as the accountants do for the month being billed.
 */
export function modconReport(
    company: string,
    summary: ModconSummary,
    month?: number,
): Uint8Array {
    const totals = addUp(summary);
    const chainSheets = summary.chains.map((c) => ({
        name: c.chain.toUpperCase(),
        grid: c,
    }));
    const sheets = [
        ...chainSheets.map(({ name, grid }) =>
            yearSheet(
                name,
                `${name} MODCON REPORT ${summary.year}`,
                company,
                summary,
                grid,
            ),
        ),
        yearSheet(
            TOTAL_SHEET,
            `MODCON REPORT ${summary.year}`,
            company,
            summary,
            totals,
            chainSheets.map((c) => c.name),
        ),
    ];

    if (month !== undefined) {
        sheets.unshift(monthSheet(company, summary, month, totals));
    }

    return writeXlsx(sheets);
}
