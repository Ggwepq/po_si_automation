import { cellRef, columnName, excelDate, writeXlsx } from '@/lib/xlsx-writer';
import type { Cell, CellStyle, SheetSpec } from '@/lib/xlsx-writer';
import type { MatrixRow, ReportPeriod, SalesMatrix } from './types';

/*
 * The accountants' "Sales Status Report" workbook (as in H&F.xlsx and
 * AUTOMAT SALES REPORT.xlsx), filled from the imported DSRs: a sheet with the
 * period's sales per item by day and by store, and a YEARLY REPORT sheet with
 * the year by month. Same layout, colours, fonts and formulas as the
 * originals; the "Price" columns hold each item's sales amount, as there.
 */

const NAVY = '1F497D';
const COLOURS = {
    title: 'FDE9D9',
    header: '948A54',
    item: '92CDDC',
    total: 'DA9694',
    grandTotal: 'FFFF00',
};
const AMOUNT = '_(* #,##0.00_);_(* \\(#,##0.00\\);_(* "-"??_);_(@_)';
const MONTHS = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
];

const thin = {
    left: 'thin',
    right: 'thin',
    top: 'thin',
    bottom: 'thin',
} as const;
const center = { horizontal: 'center', vertical: 'center' } as const;

const STYLE = {
    title: {
        font: { name: 'Arial Black', size: 48, color: NAVY },
        fill: COLOURS.title,
        border: {
            left: 'medium',
            right: 'medium',
            top: 'medium',
            bottom: 'medium',
        },
        align: center,
    },
    subtitle: {
        font: { name: 'Arial Black', size: 36, color: 'FF0000' },
        fill: 'FFFFFF',
        border: {
            left: 'medium',
            right: 'medium',
            top: 'medium',
            bottom: 'medium',
        },
        align: center,
    },
    period: {
        font: { size: 36, bold: true, color: NAVY },
        fill: COLOURS.title,
        border: { left: 'medium', right: 'medium', bottom: 'medium' },
        align: center,
    },
    header: {
        font: { name: 'Aharoni', size: 24, bold: true, color: NAVY },
        fill: COLOURS.header,
        border: { ...thin, top: 'medium' },
        align: { ...center, wrap: true },
    },
    item: {
        font: { size: 22 },
        fill: COLOURS.item,
        border: thin,
        align: { ...center, wrap: true },
    },
    label: {
        font: { size: 26, bold: true },
        border: { ...thin, left: 'medium' },
        align: center,
    },
    date: {
        font: { size: 26, bold: true },
        border: { ...thin, left: 'medium' },
        align: center,
        numFmt: 'mm-dd-yy',
    },
    qty: { font: { size: 26 }, border: thin, align: center },
    amount: { font: { size: 26 }, border: thin, align: center, numFmt: AMOUNT },
    totalLabel: {
        font: { size: 26, bold: true },
        fill: COLOURS.total,
        border: { ...thin, left: 'medium', top: 'medium', bottom: 'medium' },
        align: { horizontal: 'right', vertical: 'center' },
    },
    totalQty: {
        font: { size: 26 },
        fill: COLOURS.total,
        border: { ...thin, top: 'medium', bottom: 'medium' },
        align: center,
    },
    totalAmount: {
        font: { size: 26 },
        fill: COLOURS.total,
        border: { ...thin, top: 'medium', bottom: 'medium' },
        align: center,
        numFmt: AMOUNT,
    },
    grandQty: {
        font: { size: 28, bold: true, italic: true },
        fill: COLOURS.grandTotal,
        border: { ...thin, top: 'medium', bottom: 'medium' },
        align: center,
    },
    grandAmount: {
        font: { size: 28, bold: true, italic: true },
        fill: COLOURS.grandTotal,
        border: { ...thin, top: 'medium', bottom: 'medium' },
        align: center,
        numFmt: AMOUNT,
    },
    signLabel: { font: { size: 16 } },
    signLine: { font: { size: 20 }, border: { bottom: 'thin' } },
    signTitle: { font: { size: 20, bold: true } },
} satisfies Record<string, CellStyle>;

type Row = { label: string | number; isDate: boolean; data: MatrixRow };

/** Cells, merges and row heights of one sheet, filled top to bottom. */
class SheetBuilder {
    readonly spec: SheetSpec;

    constructor(
        name: string,
        private readonly lastColumn: number,
    ) {
        this.spec = {
            name,
            cells: new Map(),
            rowHeights: new Map(),
            columnWidths: new Map(),
            merges: [],
            frozenColumns: 2,
            zoom: 50,
            landscape: true,
        };
    }

    set(row: number, column: number, cell: Cell): void {
        if (!this.spec.cells.has(row)) {
            this.spec.cells.set(row, new Map());
        }

        this.spec.cells.get(row)?.set(column, cell);
    }

    height(row: number, points: number): void {
        this.spec.rowHeights?.set(row, points);
    }

    /** Writes `cell` in the first cell and its style across the range, so borders and fills cover the merge. */
    merge(
        row: number,
        from: number,
        to: number,
        cell: Cell,
        toRow = row,
    ): void {
        for (let r = row; r <= toRow; r++) {
            for (let c = from; c <= to; c++) {
                this.set(
                    r,
                    c,
                    r === row && c === from ? cell : { style: cell.style },
                );
            }
        }

        if (to > from || toRow > row) {
            this.spec.merges?.push(
                `${cellRef(row, from)}:${cellRef(toRow, to)}`,
            );
        }
    }

    /** Title block across the sheet: company, report name and dates. */
    titles(
        row: number,
        company: string,
        subtitle: string,
        dates: string,
    ): number {
        this.merge(row, 1, this.lastColumn, {
            value: `${company.toUpperCase()} SALES REPORT`,
            style: STYLE.title,
        });
        this.height(row, 51.6);
        this.height(row + 1, 2.4);
        this.merge(row + 2, 1, this.lastColumn, {
            value: subtitle,
            style: STYLE.subtitle,
        });
        this.height(row + 2, 56.4);
        this.merge(row + 3, 1, this.lastColumn, {
            value: dates,
            style: STYLE.period,
        });
        this.height(row + 3, 56.4);

        return row + 4;
    }
}

const sum = (values: number[], decimals: number) =>
    Number(values.reduce((a, b) => a + b, 0).toFixed(decimals));

/** "M/D/YYYY", as the accountants write dates. */
function usDate(iso: string): string {
    const [y, m, d] = iso.split('-').map(Number);

    return `${m}/${d}/${y}`;
}

/**
 * One table: "Date | Sales Detail ... | Total Qty sales | Total Amount", an
 * item-name row with a Price column after each item, one row per date (or
 * store), and a Total row. Row and column totals are Excel formulas, so an
 * edited cell still adds up.
 */
function table(
    sheet: SheetBuilder,
    startRow: number,
    items: SalesMatrix['items'],
    firstHeader: string,
    secondHeader: string,
    rows: Row[],
): number {
    const n = items.length;
    const qtyTotalColumn = 2 + n * 2;
    const amountTotalColumn = qtyTotalColumn + 1;
    let r = startRow;

    sheet.set(r, 1, { value: firstHeader, style: STYLE.header });
    if (n > 0) {
        sheet.merge(r, 2, qtyTotalColumn - 1, {
            value: 'Sales Detail',
            style: STYLE.header,
        });
    }
    sheet.merge(
        r,
        qtyTotalColumn,
        qtyTotalColumn,
        { value: 'Total Qty sales', style: STYLE.header },
        r + 1,
    );
    sheet.merge(
        r,
        amountTotalColumn,
        amountTotalColumn,
        { value: 'Total Amount', style: STYLE.header },
        r + 1,
    );
    sheet.height(r, 44.4);
    r++;

    sheet.set(r, 1, {
        value: secondHeader,
        style: { ...STYLE.item, font: { size: 16, bold: true, italic: true } },
    });
    items.forEach((item, i) => {
        sheet.set(r, 2 + i * 2, { value: item.description, style: STYLE.item });
        sheet.set(r, 3 + i * 2, { value: 'Price', style: STYLE.item });
    });
    sheet.height(r, 82.8);
    r++;

    const first = r;
    const qtyColumns = items.map((_, i) => 2 + i * 2);
    const amountColumns = qtyColumns.map((c) => c + 1);

    for (const row of rows) {
        sheet.set(r, 1, {
            value: row.label,
            style: row.isDate ? STYLE.date : STYLE.label,
        });
        items.forEach((_, i) => {
            const qty = row.data.qty[i] ?? 0;
            sheet.set(r, 2 + i * 2, {
                value: qty === 0 ? null : qty,
                style: STYLE.qty,
            });
            sheet.set(r, 3 + i * 2, {
                value: row.data.sales[i] ?? 0,
                style: STYLE.amount,
            });
        });
        sheet.set(r, qtyTotalColumn, {
            formula: `SUM(${qtyColumns.map((c) => cellRef(r, c)).join(',')})`,
            value: sum(row.data.qty, 3),
            style: STYLE.qty,
        });
        sheet.set(r, amountTotalColumn, {
            formula: `SUM(${amountColumns.map((c) => cellRef(r, c)).join(',')})`,
            value: sum(row.data.sales, 2),
            style: STYLE.amount,
        });
        sheet.height(r, 38.4);
        r++;
    }

    const last = r - 1;
    const columnSum = (c: number, decimals: number, values: number[]) => ({
        formula: rows.length
            ? `SUM(${columnName(c)}${first + 1}:${columnName(c)}${last + 1})`
            : '0',
        value: sum(values, decimals),
    });

    sheet.set(r, 1, { value: 'Total', style: STYLE.totalLabel });
    items.forEach((_, i) => {
        sheet.set(r, 2 + i * 2, {
            ...columnSum(
                2 + i * 2,
                3,
                rows.map((x) => x.data.qty[i] ?? 0),
            ),
            style: STYLE.totalQty,
        });
        sheet.set(r, 3 + i * 2, {
            ...columnSum(
                3 + i * 2,
                2,
                rows.map((x) => x.data.sales[i] ?? 0),
            ),
            style: STYLE.totalAmount,
        });
    });
    sheet.set(r, qtyTotalColumn, {
        ...columnSum(
            qtyTotalColumn,
            3,
            rows.map((x) => sum(x.data.qty, 3)),
        ),
        style: STYLE.grandQty,
    });
    sheet.set(r, amountTotalColumn, {
        ...columnSum(
            amountTotalColumn,
            2,
            rows.map((x) => sum(x.data.sales, 2)),
        ),
        style: STYLE.grandAmount,
    });
    sheet.height(r, 38.4);

    return r + 1;
}

function columnWidths(sheet: SheetBuilder, itemCount: number): void {
    const widths = sheet.spec.columnWidths;
    widths?.set(0, 2.11);
    widths?.set(1, 56.78);

    for (let i = 0; i < itemCount; i++) {
        widths?.set(2 + i * 2, 29.11);
        widths?.set(3 + i * 2, 24);
    }

    widths?.set(2 + itemCount * 2, 27.11);
    widths?.set(3 + itemCount * 2, 34.44);
}

/** Blank lines for the people who prepare, review, check and receive the report. */
function signatures(sheet: SheetBuilder, row: number, itemCount: number): void {
    const roles = ['Prepared By', 'Reviewed By', 'Checked By', 'Presented To'];
    const step = Math.max(2, Math.floor((itemCount * 2) / roles.length));

    roles.forEach((role, i) => {
        const column = 2 + i * step;
        sheet.set(row, column, { value: role, style: STYLE.signLabel });
        sheet.set(row + 3, column, { value: '', style: STYLE.signLine });
        sheet.set(row + 4, column, {
            value: 'Name and position',
            style: STYLE.signTitle,
        });
    });
}

const dateRows = (matrix: SalesMatrix): Row[] =>
    matrix.byDate.map((row) =>
        matrix.grouping === 'month'
            ? {
                  label: `${MONTHS[Number(row.date.slice(5)) - 1]} ${row.date.slice(0, 4)}`,
                  isDate: false,
                  data: row,
              }
            : { label: excelDate(row.date), isDate: true, data: row },
    );

/** The period's sheet: sales by date, then by store, then signatures. */
export function periodSheet(
    company: string,
    period: ReportPeriod,
    matrix: SalesMatrix,
): SheetSpec {
    const n = matrix.items.length;
    const month = Number(period.start.slice(5, 7)) - 1;
    const name =
        period.type === 'monthly'
            ? `MONTHLY SALES ${MONTHS[month].toUpperCase()}`
            : period.type === 'yearly'
              ? `SALES ${period.start.slice(0, 4)}`
              : `SALES ${period.start} TO ${period.end}`;
    const subtitle =
        period.type === 'monthly'
            ? 'Monthly Sales Status Report '
            : 'Sales Status Report ';
    const dates = `From ${usDate(period.start)}-${usDate(period.end)}`;
    const sheet = new SheetBuilder(name, 3 + n * 2);

    columnWidths(sheet, n);

    let row = sheet.titles(0, company, subtitle, dates);
    row = table(
        sheet,
        row,
        matrix.items,
        matrix.grouping === 'month' ? 'Month' : 'Date',
        '',
        dateRows(matrix),
    );

    row = sheet.titles(row + 3, company, subtitle, dates);
    row = table(
        sheet,
        row,
        matrix.items,
        'Date',
        'STORES',
        matrix.byStore.map((store) => ({
            label: store.name,
            isDate: false,
            data: store,
        })),
    );

    signatures(sheet, row + 2, n);

    return sheet.spec;
}

/** The YEARLY REPORT sheet: one row per month of the year. */
export function yearlySheet(
    company: string,
    year: string,
    matrix: SalesMatrix,
): SheetSpec {
    const n = matrix.items.length;
    const sheet = new SheetBuilder('YEARLY REPORT', 3 + n * 2);
    columnWidths(sheet, n);

    const row = sheet.titles(
        0,
        company,
        'Yearly Sales Status Report ',
        `From January to December ${year}`,
    );
    table(
        sheet,
        row,
        matrix.items,
        'Date',
        '',
        matrix.byDate.map((r) => ({
            label: MONTHS[Number(r.date.slice(5)) - 1],
            isDate: false,
            data: r,
        })),
    );

    return sheet.spec;
}

/** The whole workbook: the period's sheet, plus the year when the period is shorter. */
export function salesStatusReport(
    company: string,
    period: ReportPeriod,
    matrix: SalesMatrix,
    yearMatrix?: SalesMatrix,
): Uint8Array {
    const sheets = [periodSheet(company, period, matrix)];

    if (yearMatrix) {
        sheets.push(yearlySheet(company, period.start.slice(0, 4), yearMatrix));
    }

    return writeXlsx(sheets);
}
