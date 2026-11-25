import type { SalesStatus } from '@/types/auth';
import { formatMoney } from './format';
import { periodLabel } from './liquidation';
import {
    previewTotals,
    summaryPreviewTotals,
    toBatches,
} from './read-dsr-file';
import type { ParsedSalesFile } from './types';
import type { ImportBatch } from '../post-import-batch';

type Limits = SalesStatus['importLimits'];

export const KIND_LABELS: Record<ParsedSalesFile['kind'], string> = {
    detail: 'DSR',
    summary: 'DSR Summary',
    csr: 'Consolidated Sales Report',
    clr: 'Consolidated Liquidation Report',
};

/** What importing this kind of file does, shown before importing. */
export const KIND_PURPOSE: Record<ParsedSalesFile['kind'], string> = {
    detail: 'Daily sales per store and item. These make up the sales report.',
    summary:
        "SM's official daily totals. Used to check the month's DSRs; they do not add to sales.",
    csr: "SM's half-month sales per store and item. Used to check the DSRs on the Liquidation page; they do not add to sales.",
    clr: 'What each SM head office owes you per half-month, after 1% withholding tax. Shown on the Liquidation page.',
};

/** Rejects a DSR with a store-day too long for one request. */
export function assertWithinLimits(
    parsed: ParsedSalesFile,
    limits: Limits,
): void {
    const tooLong =
        parsed.kind === 'detail'
            ? parsed.reports.find((r) => r.lines.length > limits.linesPerReport)
            : undefined;

    if (tooLong) {
        throw new Error(
            `${tooLong.site_name} on ${tooLong.transaction_date} has more than ${limits.linesPerReport} lines.`,
        );
    }
}

/** Splits the parsed file into request-sized batches. */
export function batchesOf(
    parsed: ParsedSalesFile,
    limits: Limits,
): ImportBatch[] {
    switch (parsed.kind) {
        case 'summary':
            return toBatches(parsed.summaries, limits.summariesPerBatch).map(
                (rows) => ({ kind: 'summary', rows }),
            );
        case 'csr':
            return toBatches(parsed.stores, limits.csrStoresPerBatch).map(
                (rows) => ({ kind: 'csr', rows }),
            );
        case 'clr':
            return toBatches(
                parsed.liquidations,
                limits.liquidationsPerBatch,
            ).map((rows) => ({ kind: 'clr', rows }));
        default:
            return toBatches(parsed.reports, limits.reportsPerBatch).map(
                (rows) => ({ kind: 'detail', rows }),
            );
    }
}

const dateRange = (first: string | null, last: string | null) =>
    first === last ? (first ?? '—') : `${first} to ${last}`;

const periods = (rows: { period_start: string; period_end: string }[]) =>
    [...new Set(rows.map((r) => `${r.period_start}|${r.period_end}`))]
        .sort()
        .map((key) => {
            const [start, end] = key.split('|');

            return periodLabel(start, end);
        });

export type ImportFacts = {
    /** e.g. "Import 31 store-days" */
    action: string;
    /** Counts shown before importing. */
    facts: [string, string][];
    /** The dates the file covers, for linking to the report afterwards. */
    firstDate: string | null;
    lastDate: string | null;
    /** How many rows a "row" is, e.g. "store-days". */
    unit: string;
    count: number;
};

/** The key figures of a parsed file, shown for review before importing. */
export function importFacts(parsed: ParsedSalesFile): ImportFacts {
    switch (parsed.kind) {
        case 'summary': {
            const t = summaryPreviewTotals(parsed.summaries);

            return {
                action: `Import DSR Summary (${t.rowCount} store-days)`,
                facts: [
                    ['Dates', dateRange(t.firstDate, t.lastDate)],
                    ['Stores', String(t.storeCount)],
                    ['Days with 0.00 sales', String(t.noSalesDays)],
                    ['Total sales (SM)', formatMoney(t.totalSales)],
                ],
                firstDate: t.firstDate,
                lastDate: t.lastDate,
                unit: 'store-days',
                count: t.rowCount,
            };
        }
        case 'csr': {
            const lines = parsed.stores.flatMap((s) => s.lines);
            const dates = parsed.stores
                .flatMap((s) => [s.period_start, s.period_end])
                .sort();

            return {
                action: `Import ${parsed.stores.length} store periods`,
                facts: [
                    ['Periods', periods(parsed.stores).join(', ')],
                    [
                        'Stores',
                        String(
                            new Set(parsed.stores.map((s) => s.site_code)).size,
                        ),
                    ],
                    ['Item lines', lines.length.toLocaleString()],
                    [
                        'Sales excl. VAT',
                        formatMoney(
                            lines.reduce(
                                (sum, l) => sum + Number(l.total_sales),
                                0,
                            ),
                        ),
                    ],
                ],
                firstDate: dates[0] ?? null,
                lastDate: dates.at(-1) ?? null,
                unit: 'store periods',
                count: parsed.stores.length,
            };
        }
        case 'clr': {
            const dates = parsed.liquidations
                .flatMap((l) => [l.period_start, l.period_end])
                .sort();

            return {
                action: `Import ${parsed.liquidations.length} liquidations`,
                facts: [
                    ['Periods', periods(parsed.liquidations).join(', ')],
                    [
                        'Head offices',
                        [...new Set(parsed.liquidations.map((l) => l.chain))]
                            .sort()
                            .join(', '),
                    ],
                    [
                        'Stores',
                        String(
                            new Set(
                                parsed.liquidations.flatMap((l) =>
                                    l.stores.map((s) => s.site_code),
                                ),
                            ).size,
                        ),
                    ],
                    [
                        'Net amount due',
                        formatMoney(
                            parsed.liquidations.reduce(
                                (sum, l) => sum + Number(l.net_due),
                                0,
                            ),
                        ),
                    ],
                ],
                firstDate: dates[0] ?? null,
                lastDate: dates.at(-1) ?? null,
                unit: 'liquidations',
                count: parsed.liquidations.length,
            };
        }
        default: {
            const t = previewTotals(parsed.reports);

            return {
                action: `Import ${t.reportCount} store-days`,
                facts: [
                    ['Dates', dateRange(t.firstDate, t.lastDate)],
                    ['Stores', String(t.storeCount)],
                    ['Item lines', t.lineCount.toLocaleString()],
                    ['Total sales', formatMoney(t.totalSales)],
                ],
                firstDate: t.firstDate,
                lastDate: t.lastDate,
                unit: 'store-days',
                count: t.reportCount,
            };
        }
    }
}
