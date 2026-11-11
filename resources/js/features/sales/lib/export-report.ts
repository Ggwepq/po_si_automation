import * as XLSX from 'xlsx';
import type { ReportPeriod, SalesReport } from './types';

/** Builds the Excel version of a sales report: one sheet per section. */
export function reportWorkbook(
    report: SalesReport,
    period: ReportPeriod,
    scope: string,
): XLSX.WorkBook {
    const { summary } = report;
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
            ]),
        ],
        [6, 14, 36, 6, 10, 14, 9, 11, 8],
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
            ]),
        ],
        [10, 28, 10, 10, 14, 9, 7, 32],
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

export function downloadReport(
    report: SalesReport,
    period: ReportPeriod,
    scope: string,
): void {
    const name = `Sales_Report_${period.start}_to_${period.end}.xlsx`;

    XLSX.writeFile(reportWorkbook(report, period, scope), name);
}
