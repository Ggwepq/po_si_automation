import * as XLSX from 'xlsx';
import { downloadBytes } from '@/lib/workbook-file';
import { modconReport } from './modcon-report';
import { salesStatusReport } from './sales-status-report';
import type {
    ModconSummary,
    ReportPeriod,
    SalesMatrix,
    SalesReport,
} from './types';

/** Builds the Excel version of a sales report: one sheet per section. */
export function reportWorkbook(
    report: SalesReport,
    period: ReportPeriod,
    scope: string,
): XLSX.WorkBook {
    const { summary } = report;
    const hasCosts = summary.grossProfit !== null;
    /** Gross profit columns, only once some costs are set; blank for items without one. */
    const profit = (row: {
        grossProfit: number | null;
        grossMargin: number | null;
    }) => (hasCosts ? [row.grossProfit ?? '', row.grossMargin ?? ''] : []);
    const profitHeads = hasCosts ? ['Gross Profit', 'Margin %'] : [];
    const profitWidths = hasCosts ? [14, 9] : [];
    const workbook = XLSX.utils.book_new();

    const sheet = (name: string, rows: unknown[][], widths: number[]) => {
        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws['!cols'] = widths.map((wch) => ({ wch }));
        XLSX.utils.book_append_sheet(workbook, ws, name);
    };

    sheet(
        'Summary',
        [
            ['Sales Report', period.label],
            ['Period', `${period.start} to ${period.end}`],
            ['Scope', scope],
            [],
            ['Measure', 'This period', 'Previous period'],
            [
                'Total sales (excl. VAT)',
                summary.totalSales,
                summary.previous.totalSales,
            ],
            ['Quantity sold', summary.totalQty, summary.previous.totalQty],
            ['Items sold', summary.itemCount, summary.previous.itemCount],
            [
                'Stores reporting',
                summary.storeCount,
                summary.previous.storeCount,
            ],
            ['Days with sales', summary.salesDays, summary.previous.salesDays],
            [
                'Average daily sales',
                summary.averageDailySales,
                summary.previous.averageDailySales,
            ],
            ...(hasCosts
                ? [
                      [
                          'Gross profit (costed sales)',
                          summary.grossProfit,
                          summary.previous.grossProfit ?? '',
                      ],
                      [
                          'Gross margin %',
                          summary.grossMargin,
                          summary.previous.grossMargin ?? '',
                      ],
                      [
                          'Sales with a cost %',
                          summary.costCoverage,
                          summary.previous.costCoverage,
                      ],
                  ]
                : []),
        ],
        [26, 18, 18],
    );

    sheet(
        'Items',
        [
            [
                'Rank',
                'Article Code',
                'Description',
                'UOM',
                'Qty Sold',
                'Sales',
                'Share %',
                'Avg Price',
                'Stores',
                ...profitHeads,
            ],
            ...report.items.map((item, index) => [
                index + 1,
                item.code,
                item.description,
                item.uom ?? '',
                item.qty,
                item.sales,
                item.share,
                item.averagePrice,
                item.storeCount,
                ...profit(item),
            ]),
        ],
        [6, 14, 36, 6, 10, 14, 9, 11, 8, ...profitWidths],
    );

    sheet(
        'Stores',
        [
            [
                'Store Code',
                'Store',
                'Company',
                'Qty Sold',
                'Sales',
                'Share %',
                'Items',
                'Top Item',
                ...profitHeads,
            ],
            ...report.byStore.map((store) => [
                store.code,
                store.name,
                store.company,
                store.qty,
                store.sales,
                store.share,
                store.itemCount,
                store.topItem ?? '',
                ...profit(store),
            ]),
        ],
        [10, 28, 10, 10, 14, 9, 7, 32, ...profitWidths],
    );

    sheet(
        'Companies',
        [
            ['Company', 'Stores', 'Qty Sold', 'Sales', 'Share %'],
            ...report.byCompany.map((c) => [
                c.company,
                c.storeCount,
                c.qty,
                c.sales,
                c.share,
            ]),
        ],
        [14, 8, 10, 14, 9],
    );

    sheet(
        'Trend',
        [
            [
                report.trend.grouping === 'month' ? 'Month' : 'Date',
                'Qty Sold',
                'Sales',
            ],
            ...report.trend.points.map((p) => [p.date, p.qty, p.sales]),
        ],
        [12, 10, 14],
    );

    return workbook;
}

/** Every section of the report as plain sheets, for further analysis. */
export function downloadReport(
    report: SalesReport,
    period: ReportPeriod,
    scope: string,
): void {
    const name = `Sales_Report_${period.start}_to_${period.end}.xlsx`;

    XLSX.writeFile(reportWorkbook(report, period, scope), name);
}

export async function fetchJson<T>(url: string): Promise<T> {
    const response = await fetch(url, {
        headers: { Accept: 'application/json' },
        credentials: 'same-origin',
    });

    if (!response.ok) {
        throw new Error(`The sales could not be loaded (${response.status}).`);
    }

    return (await response.json()) as T;
}

/**
 * Downloads the accountants' Sales Status Report workbook. Its item grids
 * are fetched only now, so the report page itself stays light; the year's
 * months are added when the period itself is shown by day.
 */
export async function downloadStatusReport(
    company: string,
    period: ReportPeriod,
    urls: { period: string; year: string },
): Promise<void> {
    const matrix = await fetchJson<SalesMatrix>(urls.period);
    const yearMatrix =
        matrix.grouping === 'day'
            ? await fetchJson<SalesMatrix>(urls.year)
            : undefined;
    downloadBytes(
        salesStatusReport(company, period, matrix, yearMatrix),
        `${company} Sales Report ${period.label}.xlsx`,
    );
}

/**
 * Downloads the ModCon workbook for the year of the period: sales per store
 * chain and half-month, with VAT. A monthly report also gets its month sheet.
 */
export async function downloadModconReport(
    company: string,
    period: ReportPeriod,
    url: string,
): Promise<void> {
    const summary = await fetchJson<ModconSummary>(url);
    const month =
        period.type === 'monthly'
            ? Number(period.start.slice(5, 7)) - 1
            : undefined;

    downloadBytes(
        modconReport(company, summary, month),
        `${company} ModCon Report ${summary.year}.xlsx`,
    );
}
