import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import type { RowInput } from 'jspdf-autotable';
import { formatTrendLabel, percentChange, topSlices } from './format';
import { buildInsights } from './insights';
import {
    INK,
    MUTED,
    PDF_COLORS,
    barChart,
    donutWithLegend,
    pdfMoney,
    pdfQty,
    trendChart,
} from './pdf-charts';
import type { DsrCoverage, ReportPeriod, SalesReport } from './types';

export type ReportPdfInput = {
    report: SalesReport;
    period: ReportPeriod;
    coverage?: DsrCoverage;
    scope: string;
    generatedAt: string;
    /** PNG data URL of the company logo. */
    logo?: string;
    /** Opens the print dialog as soon as the PDF is shown. */
    autoPrint?: boolean;
};

const PAGE = { width: 210, height: 297, margin: 14 };
const CONTENT = PAGE.width - PAGE.margin * 2;
const HALF = (CONTENT - 6) / 2;
const MAX_ITEM_ROWS = 100;

const peso = (value: number) => `PHP ${pdfMoney(value)}`;

/**
 * A4 sales report for management: highlights first, then the numbers behind
 * them. Amounts are excl. VAT. Built entirely in the browser.
 */
export function buildReportPdf(input: ReportPdfInput): jsPDF {
    const { report, period, scope } = input;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    let y = PAGE.margin;

    doc.setProperties({
        title: `Sales Report - ${period.label}`,
        subject: scope,
        creator: 'Sales Management System',
    });

    const ensureSpace = (height: number) => {
        if (y + height > PAGE.height - 18) {
            doc.addPage();
            y = PAGE.margin;
        }
    };

    /** `keepWith`: height of the content that must stay on the heading's page. */
    const heading = (text: string, subtitle?: string, keepWith = 20) => {
        ensureSpace((subtitle ? 12 : 8) + keepWith);
        doc.setFont('helvetica', 'bold')
            .setFontSize(11)
            .setTextColor(INK)
            .text(text, PAGE.margin, y + 4);

        if (subtitle) {
            doc.setFont('helvetica', 'normal')
                .setFontSize(8)
                .setTextColor(MUTED)
                .text(subtitle, PAGE.margin, y + 8.5);
        }

        y += subtitle ? 12 : 8;
        doc.setFont('helvetica', 'normal');
    };

    const afterTable = () => {
        const last = (doc as unknown as { lastAutoTable?: { finalY?: number } })
            .lastAutoTable;
        y = (last?.finalY ?? y) + 8;
    };

    const tableStyle = {
        theme: 'grid' as const,
        margin: { left: PAGE.margin, right: PAGE.margin },
        styles: {
            fontSize: 8,
            cellPadding: 1.6,
            textColor: INK,
            lineColor: '#e3e6ef',
            lineWidth: 0.2,
        },
        headStyles: {
            fillColor: '#eef1fa',
            textColor: INK,
            fontStyle: 'bold' as const,
        },
        alternateRowStyles: { fillColor: '#fafbfe' },
    };

    // Header
    if (input.logo) {
        doc.addImage(
            input.logo,
            'PNG',
            PAGE.width - PAGE.margin - 30,
            y - 2,
            30,
            16.5,
        );
    }

    doc.setFontSize(8)
        .setTextColor(MUTED)
        .text('SALES REPORT', PAGE.margin, y + 2);
    doc.setFont('helvetica', 'bold')
        .setFontSize(18)
        .setTextColor(INK)
        .text(period.label, PAGE.margin, y + 10);
    doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(MUTED);
    doc.text(
        `${scope}  |  ${period.start} to ${period.end}  |  Sales excl. VAT, in PHP`,
        PAGE.margin,
        y + 16,
    );
    doc.text(
        `Generated ${new Date(input.generatedAt).toLocaleString('en-PH')}`,
        PAGE.margin,
        y + 20.5,
    );
    y += 25;
    doc.setDrawColor(PDF_COLORS[0])
        .setLineWidth(0.6)
        .line(PAGE.margin, y, PAGE.width - PAGE.margin, y);
    y += 6;

    // Executive highlights
    const insights = buildInsights(report, {
        previousLabel: period.previous.label,
        money: peso,
        qty: pdfQty,
        coverage: input.coverage,
    });

    heading('Executive highlights');
    doc.setFontSize(9);

    for (const insight of insights) {
        const lines = doc.splitTextToSize(
            insight.text,
            CONTENT - 40,
        ) as string[];
        ensureSpace(lines.length * 4.4 + 2);
        doc.setFont('helvetica', 'bold')
            .setTextColor(INK)
            .text(insight.title, PAGE.margin, y);
        doc.setFont('helvetica', 'normal').text(lines, PAGE.margin + 38, y);
        y += lines.length * 4.4 + 1.6;
    }

    y += 4;

    // Key figures vs previous period
    const { summary } = report;
    const change = (now: number, before: number) => {
        const pct = percentChange(now, before);

        return pct === null ? '-' : `${pct > 0 ? '+' : ''}${pct}%`;
    };
    const figures: [string, number, number, (v: number) => string][] = [
        [
            'Total sales (PHP)',
            summary.totalSales,
            summary.previous.totalSales,
            pdfMoney,
        ],
        ['Quantity sold', summary.totalQty, summary.previous.totalQty, pdfQty],
        ['Items sold', summary.itemCount, summary.previous.itemCount, String],
        [
            'Stores reporting',
            summary.storeCount,
            summary.previous.storeCount,
            String,
        ],
        [
            'Average daily sales (PHP)',
            summary.averageDailySales,
            summary.previous.averageDailySales,
            pdfMoney,
        ],
    ];

    heading('Key figures', `Compared with ${period.previous.label}`);
    autoTable(doc, {
        ...tableStyle,
        startY: y,
        head: [['Measure', period.label, period.previous.label, 'Change']],
        body: figures.map(([label, now, before, format]) => [
            label,
            format(now),
            format(before),
            change(now, before),
        ]),
        columnStyles: {
            1: { halign: 'right' },
            2: { halign: 'right' },
            3: { halign: 'right' },
        },
    });
    afterTable();

    // Charts
    const chartTitle = (text: string, x: number) =>
        doc
            .setFont('helvetica', 'bold')
            .setFontSize(9.5)
            .setTextColor(INK)
            .text(text, x, y)
            .setFont('helvetica', 'normal');

    // Store and item names are long, so those donuts get the full width.
    const LEGEND_WIDE = 135;

    ensureSpace(50);
    chartTitle('Sales share by store', PAGE.margin);
    y += 4;
    y =
        donutWithLegend(
            doc,
            topSlices(
                report.byStore,
                (s) => s.name,
                (s) => s.sales,
            ),
            PAGE.margin,
            y,
            LEGEND_WIDE,
        ) + 6;

    ensureSpace(52);
    chartTitle('Sales share by company', PAGE.margin);
    chartTitle(
        report.trend.grouping === 'month'
            ? 'Monthly sales (PHP)'
            : 'Daily sales (PHP)',
        PAGE.margin + HALF + 6,
    );
    y += 4;
    const companyBottom = donutWithLegend(
        doc,
        topSlices(
            report.byCompany,
            (c) => c.company,
            (c) => c.sales,
        ),
        PAGE.margin,
        y,
        HALF,
    );
    const trendBottom = trendChart(
        doc,
        report.trend.points.map((p) => ({
            label: formatTrendLabel(p.date),
            value: p.sales,
        })),
        PAGE.margin + HALF + 6,
        y,
        HALF,
        38,
    );
    y = Math.max(companyBottom, trendBottom) + 6;

    ensureSpace(50);
    chartTitle('Sales share by item', PAGE.margin);
    y += 4;
    y =
        donutWithLegend(
            doc,
            topSlices(
                report.items,
                (i) => i.description,
                (i) => i.sales,
                5,
            ),
            PAGE.margin,
            y,
            LEGEND_WIDE,
        ) + 6;

    // Top 10
    const topByQty = [...report.items]
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 10);

    if (topByQty.length) {
        heading(
            'Top 10 selling items',
            'By quantity sold',
            topByQty.length * 6.5 + 4,
        );
        y =
            barChart(
                doc,
                topByQty.map((i) => ({ name: i.description, value: i.qty })),
                PAGE.margin,
                y,
                CONTENT,
                pdfQty,
            ) + 6;
    }

    // Detail tables
    const shownItems = report.items.slice(0, MAX_ITEM_ROWS);
    heading(
        'Items sold',
        report.items.length > MAX_ITEM_ROWS
            ? `Top ${MAX_ITEM_ROWS} of ${report.items.length} items by sales. The Excel export lists all.`
            : `${report.items.length} items, ranked by sales`,
    );
    autoTable(doc, {
        ...tableStyle,
        startY: y,
        head: [
            [
                '#',
                'Item',
                'Code',
                'Qty sold',
                'Sales (PHP)',
                'Share',
                'Avg price',
                'Stores',
            ],
        ],
        body: shownItems.map((item, index): RowInput => [
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
            0: { halign: 'right', cellWidth: 8 },
            3: { halign: 'right' },
            4: { halign: 'right' },
            5: { halign: 'right' },
            6: { halign: 'right' },
            7: { halign: 'right' },
        },
    });
    afterTable();

    heading('Sales by store');
    autoTable(doc, {
        ...tableStyle,
        startY: y,
        head: [
            [
                'Store',
                'Company',
                'Qty sold',
                'Sales (PHP)',
                'Share',
                'Items',
                'Best seller',
            ],
        ],
        body: report.byStore.map((s): RowInput => [
            `${s.name} (${s.code})`,
            s.company,
            pdfQty(s.qty),
            pdfMoney(s.sales),
            `${s.share}%`,
            s.itemCount,
            s.topItem ?? '-',
        ]),
        columnStyles: {
            2: { halign: 'right' },
            3: { halign: 'right' },
            4: { halign: 'right' },
            5: { halign: 'right' },
        },
    });
    afterTable();

    heading('Sales by company');
    autoTable(doc, {
        ...tableStyle,
        startY: y,
        head: [['Company', 'Stores', 'Qty sold', 'Sales (PHP)', 'Share']],
        body: report.byCompany.map((c): RowInput => [
            c.company,
            c.storeCount,
            pdfQty(c.qty),
            pdfMoney(c.sales),
            `${c.share}%`,
        ]),
        columnStyles: {
            1: { halign: 'right' },
            2: { halign: 'right' },
            3: { halign: 'right' },
            4: { halign: 'right' },
        },
    });

    // Footer on every page
    const pages = doc.getNumberOfPages();

    for (let page = 1; page <= pages; page++) {
        doc.setPage(page);
        doc.setFontSize(7).setTextColor(MUTED);
        doc.text(
            'Sales Management System  |  Park Solutions Inc.  |  Source: SM Vendor Portal DSR',
            PAGE.margin,
            PAGE.height - 8,
        );
        doc.text(
            `Page ${page} of ${pages}`,
            PAGE.width - PAGE.margin,
            PAGE.height - 8,
            { align: 'right' },
        );
    }

    if (input.autoPrint) {
        doc.autoPrint();
    }

    return doc;
}
