import { cellRef, excelDate, writeXlsx } from '@/lib/xlsx-writer';
import type { Cell, CellStyle, SheetSpec } from '@/lib/xlsx-writer';
import { topSlices } from './format';
import type { Slice } from './format';
import type { Liquidation, LiquidationStatus } from './types';

/** SM rounds per head office, so amounts within ₱1 count as equal. */
export const TOLERANCE = 1;

export const STATUS_LABELS: Record<LiquidationStatus, string> = {
    unpaid: 'Unpaid',
    short: 'Short',
    paid: 'Paid',
    over: 'Overpaid',
};

/** "Nov 1–15, 2026" */
export function periodLabel(start: string, end: string): string {
    const [y, m, d] = start.split('-').map(Number);
    const endDay = Number(end.split('-')[2]);
    const month = new Date(y, m - 1, d).toLocaleDateString('en-PH', {
        month: 'short',
    });

    return `${month} ${d}–${endDay}, ${y}`;
}

/** "Nov 1–15" (without year, for chart axes within a single year). */
export function shortPeriodLabel(start: string, end: string): string {
    const [y, m, d] = start.split('-').map(Number);
    const endDay = Number(end.split('-')[2]);
    const month = new Date(y, m - 1, d).toLocaleDateString('en-PH', {
        month: 'short',
    });

    return `${month} ${d}–${endDay}`;
}

export const yearOf = (l: Pick<Liquidation, 'periodEnd'>) =>
    Number(l.periodEnd.slice(0, 4));

const round = (n: number) => Math.round(n * 100) / 100;

export type LiquidationPeriodPoint = {
    key: string;
    label: string;
    netDue: number;
    paid: number;
    outstanding: number;
    sales: number;
    dsrSales: number;
};

/** Half-month settlement totals in chronological order, for the collection bar chart. */
export function liquidationByPeriod(
    liquidations: Liquidation[],
): LiquidationPeriodPoint[] {
    const periods = new Map<string, LiquidationPeriodPoint>();

    for (const l of liquidations) {
        const key = `${l.periodStart}|${l.periodEnd}`;
        const point = periods.get(key) ?? {
            key,
            label: shortPeriodLabel(l.periodStart, l.periodEnd),
            netDue: 0,
            paid: 0,
            outstanding: 0,
            sales: 0,
            dsrSales: 0,
        };
        point.netDue = round(point.netDue + l.netDue);
        point.paid = round(point.paid + l.paid);
        point.outstanding = round(point.outstanding + Math.max(l.balance, 0));
        point.sales = round(point.sales + l.sales);
        point.dsrSales = round(point.dsrSales + l.dsrSales);
        periods.set(key, point);
    }

    return [...periods.values()].sort((a, b) => a.key.localeCompare(b.key));
}

/** Net amount due per SM chain (SVI, SSM, SMCo), as pie chart slices. */
export function liquidationByChain(liquidations: Liquidation[]): Slice[] {
    const chains = new Map<string, number>();

    for (const l of liquidations) {
        chains.set(l.chain, round((chains.get(l.chain) ?? 0) + l.netDue));
    }

    return topSlices(
        [...chains.entries()].map(([chain, netDue]) => ({ chain, netDue })),
        (c) => c.chain,
        (c) => c.netDue,
    );
}

/** Liquidated sales (excl. VAT) per store across periods, as pie chart slices. */
export function liquidationByStore(liquidations: Liquidation[]): Slice[] {
    const stores = new Map<string, { name: string; sales: number }>();

    for (const l of liquidations) {
        for (const s of l.stores) {
            const current = stores.get(s.code) ?? { name: s.name, sales: 0 };
            current.sales = round(current.sales + s.smSales);
            stores.set(s.code, current);
        }
    }

    return topSlices(
        [...stores.values()],
        (s) => s.name,
        (s) => s.sales,
    );
}

export function liquidationTotals(liquidations: Liquidation[]) {
    const sum = (pick: (l: Liquidation) => number) =>
        round(liquidations.reduce((total, l) => total + pick(l), 0));

    return {
        sales: sum((l) => l.sales),
        netDue: sum((l) => l.netDue),
        ewt: sum((l) => l.ewt),
        paid: sum((l) => l.paid),
        outstanding: sum((l) => Math.max(l.balance, 0)),
        unpaidCount: liquidations.filter(
            (l) => l.status !== 'paid' && l.status !== 'over',
        ).length,
        /** Periods whose DSRs differ from SM's figure. */
        dsrIssues: liquidations.filter((l) => !l.dsrMatches && l.dsrSales !== 0)
            .length,
        /** Periods with no DSR imported yet: nothing to check against. */
        dsrMissing: liquidations.filter(
            (l) => !l.dsrMatches && l.dsrSales === 0,
        ).length,
    };
}

export type EwtMonth = {
    /** YYYY-MM, by the period's end date. */
    month: string;
    chains: Record<string, { sales: number; ewt: number; netDue: number }>;
    sales: number;
    ewt: number;
    netDue: number;
};

/** Withholding tax per month and chain, for the BIR 2307 certificates. */
export function ewtByMonth(liquidations: Liquidation[]): EwtMonth[] {
    const months = new Map<string, EwtMonth>();

    for (const l of liquidations) {
        const key = l.periodEnd.slice(0, 7);
        const month = months.get(key) ?? {
            month: key,
            chains: {},
            sales: 0,
            ewt: 0,
            netDue: 0,
        };
        const chain = (month.chains[l.chain] ??= {
            sales: 0,
            ewt: 0,
            netDue: 0,
        });
        chain.sales = round(chain.sales + l.sales);
        chain.ewt = round(chain.ewt + l.ewt);
        chain.netDue = round(chain.netDue + l.netDue);
        month.sales = round(month.sales + l.sales);
        month.ewt = round(month.ewt + l.ewt);
        month.netDue = round(month.netDue + l.netDue);
        months.set(key, month);
    }

    return [...months.values()].sort((a, b) => b.month.localeCompare(a.month));
}

export function monthLabel(month: string): string {
    const [y, m] = month.split('-').map(Number);

    return new Date(y, m - 1, 1).toLocaleDateString('en-PH', {
        month: 'long',
        year: 'numeric',
    });
}

const PESO = '#,##0.00;[Red]-#,##0.00';
const HEADER: CellStyle = {
    font: { bold: true, color: 'FFFFFF' },
    fill: '1F3864',
    align: { horizontal: 'center', vertical: 'center', wrap: true },
    border: { left: 'thin', right: 'thin', top: 'thin', bottom: 'thin' },
};
const BODY: CellStyle = {
    border: { left: 'thin', right: 'thin', top: 'thin', bottom: 'thin' },
};
const MONEY: CellStyle = { ...BODY, numFmt: PESO };
const DATE: CellStyle = { ...BODY, numFmt: 'mmm d, yyyy' };
const TOTAL: CellStyle = { ...MONEY, font: { bold: true }, fill: 'DCE6F1' };
const TITLE: CellStyle = { font: { bold: true, size: 14 } };

type Column<T> = {
    title: string;
    width: number;
    value: (row: T) => string | number | null;
    style?: CellStyle;
    /** Adds a SUM formula in the total row. */
    total?: boolean;
};

/** A titled table with a header row, one row per item and an optional total row. */
function tableSheet<T>(
    name: string,
    title: string,
    rows: T[],
    columns: Column<T>[],
): SheetSpec {
    const cells = new Map<number, Map<number, Cell>>();
    const put = (r: number, c: number, cell: Cell) => {
        if (!cells.has(r)) {
            cells.set(r, new Map());
        }

        cells.get(r)?.set(c, cell);
    };
    const first = 3;

    put(0, 0, { value: title, style: TITLE });
    columns.forEach((column, c) =>
        put(2, c, { value: column.title, style: HEADER }),
    );
    rows.forEach((row, r) =>
        columns.forEach((column, c) =>
            put(first + r, c, {
                value: column.value(row),
                style: column.style ?? BODY,
            }),
        ),
    );

    if (rows.length && columns.some((c) => c.total)) {
        const last = first + rows.length - 1;
        const totalRow = last + 1;
        put(totalRow, 0, {
            value: 'TOTAL',
            style: { ...TOTAL, numFmt: undefined },
        });
        columns.forEach((column, c) => {
            if (column.total) {
                const value = rows.reduce(
                    (sum, row) => sum + Number(column.value(row) ?? 0),
                    0,
                );
                put(totalRow, c, {
                    formula: `SUM(${cellRef(first, c)}:${cellRef(last, c)})`,
                    value: round(value),
                    style: TOTAL,
                });
            } else if (c > 0) {
                put(totalRow, c, { style: TOTAL });
            }
        });
    }

    return {
        name,
        cells,
        columnWidths: new Map(columns.map((c, i) => [i, c.width])),
        rowHeights: new Map([[2, 30]]),
        landscape: true,
    };
}

/** The Liquidation page as a workbook: liquidations, store check and EWT by month. */
export function liquidationWorkbook(
    liquidations: Liquidation[],
    company: string,
): Uint8Array {
    const stores = liquidations.flatMap((l) =>
        l.stores.map((s) => ({ ...s, liquidation: l })),
    );

    return writeXlsx([
        tableSheet(
            `Liquidations`,
            `${company} — SM liquidations`,
            liquidations,
            [
                {
                    title: 'Period start',
                    width: 13,
                    value: (l) => excelDate(l.periodStart),
                    style: DATE,
                },
                {
                    title: 'Period end',
                    width: 13,
                    value: (l) => excelDate(l.periodEnd),
                    style: DATE,
                },
                {
                    title: 'Head office',
                    width: 22,
                    value: (l) => `${l.centerCode} ${l.centerName}`,
                },
                {
                    title: 'Payment term',
                    width: 10,
                    value: (l) => l.paymentTerm,
                },
                {
                    title: 'Sales excl. VAT',
                    width: 15,
                    value: (l) => l.sales,
                    style: MONEY,
                    total: true,
                },
                {
                    title: 'VAT',
                    width: 13,
                    value: (l) => l.vat,
                    style: MONEY,
                    total: true,
                },
                {
                    title: 'Amount payable',
                    width: 15,
                    value: (l) => l.amountPayable,
                    style: MONEY,
                    total: true,
                },
                {
                    title: 'EWT 1%',
                    width: 12,
                    value: (l) => l.ewt,
                    style: MONEY,
                    total: true,
                },
                {
                    title: 'Net amount due',
                    width: 15,
                    value: (l) => l.netDue,
                    style: MONEY,
                    total: true,
                },
                {
                    title: 'DSR sales',
                    width: 15,
                    value: (l) => l.dsrSales,
                    style: MONEY,
                    total: true,
                },
                {
                    title: 'DSR − SM',
                    width: 12,
                    value: (l) => l.dsrDifference,
                    style: MONEY,
                    total: true,
                },
                {
                    title: 'Received',
                    width: 15,
                    value: (l) => l.paid,
                    style: MONEY,
                    total: true,
                },
                {
                    title: 'Balance',
                    width: 14,
                    value: (l) => l.balance,
                    style: MONEY,
                    total: true,
                },
                {
                    title: 'Status',
                    width: 10,
                    value: (l) => STATUS_LABELS[l.status],
                },
                {
                    title: 'Payment refs',
                    width: 24,
                    value: (l) =>
                        l.payments
                            .map((p) => p.reference ?? p.paidOn)
                            .join(', '),
                },
            ],
        ),
        tableSheet(
            'Stores',
            `${company} — liquidated sales per store vs DSR`,
            stores,
            [
                {
                    title: 'Period',
                    width: 18,
                    value: (s) =>
                        periodLabel(
                            s.liquidation.periodStart,
                            s.liquidation.periodEnd,
                        ),
                },
                { title: 'Chain', width: 8, value: (s) => s.liquidation.chain },
                { title: 'Store code', width: 10, value: (s) => s.code },
                { title: 'Store', width: 26, value: (s) => s.name },
                {
                    title: 'SM sales excl. VAT',
                    width: 15,
                    value: (s) => s.smSales,
                    style: MONEY,
                    total: true,
                },
                {
                    title: 'DSR sales',
                    width: 15,
                    value: (s) => s.dsrSales,
                    style: MONEY,
                    total: true,
                },
                {
                    title: 'DSR − SM',
                    width: 12,
                    value: (s) => s.difference,
                    style: MONEY,
                    total: true,
                },
                {
                    title: 'CSR sales',
                    width: 15,
                    value: (s) => s.csrSales,
                    style: MONEY,
                    total: true,
                },
                {
                    title: 'Days without DSR',
                    width: 30,
                    value: (s) =>
                        s.missingDays.map((d) => d.slice(5)).join(', '),
                },
            ],
        ),
        tableSheet(
            'EWT by month',
            `${company} — 1% withholding tax by month`,
            ewtByMonth(liquidations).flatMap((m) =>
                Object.entries(m.chains).map(([chain, v]) => ({
                    month: m.month,
                    chain,
                    ...v,
                })),
            ),
            [
                {
                    title: 'Month',
                    width: 16,
                    value: (r) => monthLabel(r.month),
                },
                { title: 'Chain', width: 8, value: (r) => r.chain },
                {
                    title: 'Sales excl. VAT',
                    width: 15,
                    value: (r) => r.sales,
                    style: MONEY,
                    total: true,
                },
                {
                    title: 'EWT 1%',
                    width: 13,
                    value: (r) => r.ewt,
                    style: MONEY,
                    total: true,
                },
                {
                    title: 'Net amount due',
                    width: 15,
                    value: (r) => r.netDue,
                    style: MONEY,
                    total: true,
                },
            ],
        ),
    ]);
}
