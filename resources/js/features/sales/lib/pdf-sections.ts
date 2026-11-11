import { autoTable } from 'jspdf-autotable';
import type { RowInput } from 'jspdf-autotable';
import { distributionGaps, storeConcentration } from './ceo-metrics';
import { formatTrendLabel, topSlices } from './format';
import { donutWithLegend, pdfMoney, pdfQty, peso } from './pdf-charts';
import { CONTENT, HALF, PAGE } from './pdf-layout';
import type { PdfLayout } from './pdf-layout';
import { RECONCILE_LABELS, reconciliationSentence } from './reconciliation';
import type { ReportPdfInput } from './report-pdf';
import type { SalesReport } from './types';

/*
 * Chapters after the executive summary: stores, products and the appendix.
 * Each starts on its own page so the report can be split and forwarded.
 */

const MAX_ITEM_ROWS = 100;
const MAX_ISSUE_ROWS = 40;
const right = { halign: 'right' as const };
const pricePerUnit = (sales: number, qty: number) =>
    qty > 0 ? sales / qty : 0;

export function storeChapter(page: PdfLayout, report: SalesReport): void {
    const total = report.summary.totalSales;
    page.chapter(
        1,
        'Store performance',
        'How each store and company contributed to net sales in the period, ranked from highest to lowest.',
    );

    page.chartTitle('Share of net sales by store', PAGE.margin);
    page.y += 4;
    page.y =
        donutWithLegend(
            page.doc,
            topSlices(
                report.byStore,
                (s) => s.name,
                (s) => s.sales,
                7,
            ),
            PAGE.margin,
            page.y,
            CONTENT,
            {
                radius: 23,
                centre: { value: pdfMoney(total), label: 'Net sales (PHP)' },
            },
        ) + 3;

    const reliance = storeConcentration(report.byStore);

    if (reliance) {
        page.note(
            `The top ${reliance.topCount} of ${reliance.storeCount} stores generate ${reliance.share}% of net sales. ${
                reliance.share >= 50
                    ? 'Results depend heavily on these stores; protect their stock and staffing.'
                    : 'Sales are spread fairly evenly across stores.'
            }`,
        );
    }

    page.heading('Store scorecard', 'Ranked by net sales', 30);
    autoTable(page.doc, {
        ...page.tableStyle(),
        head: [
            [
                '#',
                'Store',
                'Co.',
                'Net sales',
                'Share',
                'Units',
                'Avg price',
                'Items',
                'Best seller',
            ],
        ],
        body: report.byStore.map((s, index): RowInput => [
            index + 1,
            `${s.name}\n${s.code}`,
            s.company,
            pdfMoney(s.sales),
            `${s.share}%`,
            pdfQty(s.qty),
            pdfMoney(pricePerUnit(s.sales, s.qty)),
            s.itemCount,
            s.topItem ?? '-',
        ]),
        columnStyles: {
            0: { ...right, cellWidth: 7 },
            3: right,
            4: right,
            5: right,
            6: right,
            7: right,
            8: { cellWidth: 'wrap', fontSize: 7 },
        },
    });
    page.afterTable();

    page.heading('Sales by company', undefined, 25);
    autoTable(page.doc, {
        ...page.tableStyle(),
        head: [
            [
                'Company',
                'Stores',
                'Net sales (PHP)',
                'Share',
                'Units',
                'Sales per store (PHP)',
            ],
        ],
        body: report.byCompany.map((c): RowInput => [
            c.company,
            c.storeCount,
            pdfMoney(c.sales),
            `${c.share}%`,
            pdfQty(c.qty),
            pdfMoney(c.storeCount ? c.sales / c.storeCount : 0),
        ]),
        columnStyles: { 1: right, 2: right, 3: right, 4: right, 5: right },
    });
    page.afterTable();
}

export function productChapter(page: PdfLayout, report: SalesReport): void {
    const { items } = report;
    const stores = report.summary.storeCount;
    page.chapter(
        2,
        'Product performance',
        'Which products drive revenue and volume, where distribution can grow, and which products need attention.',
    );

    const top = page.y;
    page.chartTitle('Revenue mix', PAGE.margin);
    page.y += 4;
    const revenueBottom = donutWithLegend(
        page.doc,
        topSlices(
            items,
            (i) => i.description,
            (i) => i.sales,
            5,
        ),
        PAGE.margin,
        page.y,
        HALF,
        {
            radius: 16,
            showAmount: false,
        },
    );
    page.y = top;
    page.chartTitle('Volume mix (units)', PAGE.margin + HALF + 8);
    page.y += 4;
    const volumeBottom = donutWithLegend(
        page.doc,
        topSlices(
            items,
            (i) => i.description,
            (i) => i.qty,
            5,
        ),
        PAGE.margin + HALF + 8,
        page.y,
        HALF,
        {
            radius: 16,
            showAmount: false,
            format: pdfQty,
        },
    );
    page.y = Math.max(revenueBottom, volumeBottom) + 4;

    const topTen = [...items].sort((a, b) => b.sales - a.sales).slice(0, 10);
    page.heading('Top 10 products', 'Ranked by net sales', 30);
    autoTable(page.doc, {
        ...page.tableStyle(),
        head: [
            [
                '#',
                'Product',
                'Units',
                'Net sales (PHP)',
                'Share',
                'Avg price',
                'Sold in',
            ],
        ],
        body: topTen.map((item, index): RowInput => [
            index + 1,
            `${item.description}\n${item.code}`,
            pdfQty(item.qty),
            pdfMoney(item.sales),
            `${item.share}%`,
            pdfMoney(item.averagePrice),
            `${item.storeCount} of ${stores} stores`,
        ]),
        columnStyles: {
            0: { ...right, cellWidth: 7 },
            2: right,
            3: right,
            4: right,
            5: right,
            6: right,
        },
    });
    page.afterTable();

    const gaps = distributionGaps(items, stores)
        .sort((a, b) => b.potential - a.potential)
        .slice(0, 5);

    if (gaps.length) {
        page.heading(
            'Growth opportunities',
            'Best sellers not yet sold in every store. Upside is an estimate: missing stores selling at the current average per store.',
            30,
        );
        autoTable(page.doc, {
            ...page.tableStyle(),
            head: [
                [
                    'Product',
                    'Sold in',
                    'Missing from',
                    'Avg sales per store',
                    'Estimated upside (PHP)',
                ],
            ],
            body: gaps.map((gap): RowInput => [
                gap.item.description,
                `${gap.item.storeCount} stores`,
                `${gap.missingStores} store${gap.missingStores === 1 ? '' : 's'}`,
                pdfMoney(gap.salesPerStore),
                pdfMoney(gap.potential),
            ]),
            columnStyles: {
                1: right,
                2: right,
                3: right,
                4: { ...right, fontStyle: 'bold' },
            },
        });
        page.afterTable();
    }

    if (items.length > 10) {
        const slow = [...items].sort((a, b) => a.sales - b.sales).slice(0, 5);
        page.heading(
            'Slow movers',
            'Lowest net sales in the period: review pricing, placement or listing',
            30,
        );
        autoTable(page.doc, {
            ...page.tableStyle(),
            head: [['Product', 'Units', 'Net sales (PHP)', 'Share', 'Sold in']],
            body: slow.map((item): RowInput => [
                item.description,
                pdfQty(item.qty),
                pdfMoney(item.sales),
                `${item.share}%`,
                `${item.storeCount} of ${stores} stores`,
            ]),
            columnStyles: { 1: right, 2: right, 3: right, 4: right },
        });
        page.afterTable();
    }
}

export function appendixChapter(page: PdfLayout, input: ReportPdfInput): void {
    const { report, coverage, reconciliation } = input;
    page.chapter(
        3,
        'Appendix',
        'Full product list, data quality checks and notes on how the figures are prepared.',
    );

    page.heading(
        'All products',
        report.items.length > MAX_ITEM_ROWS
            ? `Top ${MAX_ITEM_ROWS} of ${report.items.length} products by net sales; the Excel export lists all.`
            : `${report.items.length} products, ranked by net sales`,
        30,
    );
    autoTable(page.doc, {
        ...page.tableStyle(),
        head: [
            [
                '#',
                'Product',
                'Code',
                'Units',
                'Net sales (PHP)',
                'Share',
                'Avg price',
                'Stores',
            ],
        ],
        body: report.items
            .slice(0, MAX_ITEM_ROWS)
            .map((item, index): RowInput => [
                index + 1,
                item.description,
                item.code,
                pdfQty(item.qty),
                pdfMoney(item.sales),
                `${item.share}%`,
                pdfMoney(item.averagePrice),
                item.storeCount,
            ]),
        columnStyles: {
            0: { ...right, cellWidth: 7 },
            3: right,
            4: right,
            5: right,
            6: right,
            7: right,
        },
    });
    page.afterTable();

    page.heading('Data quality', undefined, 20);
    const gaps = coverage?.daysWithoutAnyDsr ?? [];
    page.note(
        coverage?.complete
            ? `Completeness: every store has a DSR, or SM shows no sales, for all ${coverage.daysChecked ?? 0} days checked.`
            : gaps.length
              ? `Completeness: ${gaps.length} day${gaps.length === 1 ? '' : 's'} have no imported DSR (${gaps.slice(0, 8).map(formatTrendLabel).join(', ')}${gaps.length > 8 ? ', ...' : ''}); totals may be understated.`
              : 'Completeness: some stores have no DSR on some days; import the DSR Summary to confirm these were days without sales.',
    );
    page.note(
        (reconciliation && reconciliationSentence(reconciliation, peso)) ??
            "Month-end check: SM's DSR Summary for this period has not been imported, so totals are not yet verified against SM.",
    );

    if (reconciliation?.checked && reconciliation.issues.length) {
        page.heading(
            'Store-days that need attention',
            `First ${Math.min(reconciliation.issues.length, MAX_ISSUE_ROWS)} shown`,
            25,
        );
        autoTable(page.doc, {
            ...page.tableStyle(),
            head: [
                [
                    'Date',
                    'Store',
                    'SM Summary',
                    'Imported DSR',
                    'Difference',
                    'Status',
                ],
            ],
            body: reconciliation.issues
                .slice(0, MAX_ISSUE_ROWS)
                .map((issue): RowInput => [
                    formatTrendLabel(issue.date),
                    `${issue.siteName} (${issue.siteCode})`,
                    issue.summary === null
                        ? '-'
                        : pdfMoney(Number(issue.summary)),
                    issue.detail === null
                        ? '-'
                        : pdfMoney(Number(issue.detail)),
                    pdfMoney(Number(issue.difference)),
                    RECONCILE_LABELS[issue.status],
                ]),
            columnStyles: { 2: right, 3: right, 4: right },
        });
        page.afterTable();
    }

    page.heading('About this report', undefined, 20);
    page.note(
        `Source: SM Vendor Portal Daily Sales Reports (DSR). Net sales exclude VAT and are in Philippine pesos. Comparisons use ${input.period.previous.label}. ` +
            'Estimated upside figures are projections, not forecasts. Prepared by the Sales Management System, Park Solutions Inc.',
    );
}
