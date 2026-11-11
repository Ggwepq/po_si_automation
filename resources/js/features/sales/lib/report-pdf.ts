import { jsPDF } from 'jspdf';
import { hasPrevious, unitEconomics, weekdayWeekendSplit } from './ceo-metrics';
import { percentChange, topSlices } from './format';
import { buildInsights } from './insights';
import {
    INK,
    MUTED,
    donutWithLegend,
    pdfMoney,
    pdfQty,
    peso,
} from './pdf-charts';
import { ACCENT, HALF, NAVY, PAGE, PdfLayout } from './pdf-layout';
import type { Tile, Tone } from './pdf-layout';
import { appendixChapter, productChapter, storeChapter } from './pdf-sections';
import { issueCount } from './reconciliation';
import type {
    DsrCoverage,
    DsrReconciliation,
    ReportPeriod,
    SalesReport,
    SalesTotals,
} from './types';

export type ReportPdfInput = {
    report: SalesReport;
    period: ReportPeriod;
    coverage?: DsrCoverage;
    reconciliation?: DsrReconciliation;
    scope: string;
    generatedAt: string;
    /** PNG data URL of the company logo. */
    logo?: string;
    /** Opens the print dialog as soon as the PDF is shown. */
    autoPrint?: boolean;
};

const REPORT_TITLES: Record<ReportPeriod['type'], string> = {
    daily: 'Daily sales report',
    weekly: 'Weekly sales report',
    monthly: 'Monthly sales report',
    quarterly: 'Quarterly sales report',
    yearly: 'Annual sales report',
    custom: 'Sales report',
};

/**
 * A4 sales report written for management: a one-page executive summary,
 * then store performance, product performance and an appendix. Charts are
 * pies only. Amounts are net of VAT. Built entirely in the browser.
 */
export function buildReportPdf(input: ReportPdfInput): jsPDF {
    const { report, period, scope } = input;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const page = new PdfLayout(doc);
    const title = REPORT_TITLES[period.type];

    doc.setProperties({
        title: `${title} - ${period.label}`,
        subject: scope,
        creator: 'Sales Management System',
    });

    coverBand(page, input, title);
    summaryPage(page, input);
    storeChapter(page, report);
    productChapter(page, report);
    appendixChapter(page, input);
    page.finish(`${title} - ${period.label}`, 'Source: SM Vendor Portal DSR');

    if (input.autoPrint) {
        doc.autoPrint();
    }

    return doc;
}

function coverBand(page: PdfLayout, input: ReportPdfInput, title: string) {
    const { doc } = page;
    const { period } = input;

    doc.setFillColor(NAVY).rect(0, 0, PAGE.width, 46, 'F');
    doc.setFillColor(ACCENT).rect(0, 46, PAGE.width, 1.2, 'F');

    if (input.logo) {
        doc.setFillColor('#ffffff').roundedRect(
            PAGE.width - PAGE.margin - 38,
            11,
            38,
            23,
            2,
            2,
            'F',
        );
        doc.addImage(
            input.logo,
            'PNG',
            PAGE.width - PAGE.margin - 35,
            13.5,
            32,
            17.6,
        );
    }

    doc.setFont('helvetica', 'bold').setFontSize(8.5).setTextColor(ACCENT);
    doc.text(title.toUpperCase(), PAGE.margin, 15);
    doc.setFontSize(22)
        .setTextColor('#ffffff')
        .text(period.label, PAGE.margin, 25);
    doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor('#d5daf0');
    doc.text(
        `${input.scope}  |  ${period.start} to ${period.end}  |  Net sales excl. VAT, in PHP`,
        PAGE.margin,
        32,
    );
    doc.text(
        `Prepared ${new Date(input.generatedAt).toLocaleString('en-PH')}  |  Park Solutions Inc.`,
        PAGE.margin,
        37,
    );
    page.y = 54;
}

/** "+12.3% vs Sep 2026", coloured by direction. */
function changeNote(
    now: number,
    before: number,
    previous: string,
    comparable: boolean,
): Pick<Tile, 'note' | 'tone'> {
    const pct = comparable ? percentChange(now, before) : null;

    if (pct === null) {
        return { note: 'No prior-period data', tone: 'neutral' };
    }

    return {
        note: `${pct > 0 ? '+' : ''}${pct}% vs ${previous}`,
        tone: pct > 0 ? 'positive' : pct < 0 ? 'negative' : 'neutral',
    };
}

function countNote(
    now: number,
    before: number,
    previous: string,
    comparable: boolean,
): Pick<Tile, 'note' | 'tone'> {
    if (!comparable) {
        return { note: 'No prior-period data', tone: 'neutral' };
    }

    const delta = now - before;

    return {
        note:
            delta === 0
                ? `Same as ${previous}`
                : `${delta > 0 ? '+' : ''}${delta} vs ${previous}`,
        tone: delta > 0 ? 'positive' : delta < 0 ? 'negative' : 'neutral',
    };
}

function dataStatus(input: ReportPdfInput): Tile {
    const check = input.reconciliation;
    const gaps = input.coverage?.daysWithoutAnyDsr.length ?? 0;

    if (check?.checked && check.balanced) {
        return {
            label: 'Data status',
            value: 'Verified',
            note: "Matches SM's DSR Summary",
            tone: 'positive',
        };
    }

    if (check?.checked) {
        return {
            label: 'Data status',
            value: 'Check needed',
            note: `${issueCount(check)} store-days differ from SM`,
            tone: 'negative',
        };
    }

    if (gaps > 0) {
        return {
            label: 'Data status',
            value: 'Incomplete',
            note: `${gaps} day${gaps === 1 ? '' : 's'} without any DSR`,
            tone: 'warning',
        };
    }

    return {
        label: 'Data status',
        value: 'Not verified',
        note: "Import SM's DSR Summary to verify",
        tone: 'warning',
    };
}

function kpiTiles(input: ReportPdfInput): Tile[] {
    const { summary } = input.report;
    const prev: SalesTotals = summary.previous;
    const label = input.period.previous.label;
    const comparable = hasPrevious(prev);
    const now = unitEconomics(summary);
    const before = unitEconomics(prev);

    return [
        {
            label: 'Net sales (PHP)',
            value: pdfMoney(summary.totalSales),
            ...changeNote(
                summary.totalSales,
                prev.totalSales,
                label,
                comparable,
            ),
        },
        {
            label: 'Units sold',
            value: pdfQty(summary.totalQty),
            ...changeNote(summary.totalQty, prev.totalQty, label, comparable),
        },
        {
            label: 'Avg daily sales (PHP)',
            value: pdfMoney(summary.averageDailySales),
            ...changeNote(
                summary.averageDailySales,
                prev.averageDailySales,
                label,
                comparable,
            ),
        },
        {
            label: 'Avg price per unit (PHP)',
            value: pdfMoney(now.pricePerUnit),
            ...changeNote(
                now.pricePerUnit,
                before.pricePerUnit,
                label,
                comparable,
            ),
        },
        {
            label: 'Stores selling',
            value: String(summary.storeCount),
            ...countNote(
                summary.storeCount,
                prev.storeCount,
                label,
                comparable,
            ),
        },
        {
            label: 'Sales per store (PHP)',
            value: pdfMoney(now.salesPerStore),
            ...changeNote(
                now.salesPerStore,
                before.salesPerStore,
                label,
                comparable,
            ),
        },
        {
            label: 'Products sold',
            value: String(summary.itemCount),
            ...countNote(summary.itemCount, prev.itemCount, label, comparable),
        },
        dataStatus(input),
    ];
}

function summaryPage(page: PdfLayout, input: ReportPdfInput) {
    const { report, period } = input;
    const { doc } = page;

    page.heading(
        'Performance at a glance',
        hasPrevious(report.summary.previous)
            ? `Compared with ${period.previous.label}`
            : `${period.previous.label} has no imported sales to compare with`,
        50,
    );
    page.tiles(kpiTiles(input));

    page.heading('Key takeaways', undefined, 30);
    page.takeaways(
        buildInsights(report, {
            previousLabel: period.previous.label,
            money: peso,
            qty: pdfQty,
            coverage: input.coverage,
            reconciliation: input.reconciliation,
        })
            // The tiles already show the total.
            .filter((insight) => insight.title !== 'Total sales')
            .map((insight) => ({ ...insight, tone: insight.tone as Tone })),
    );

    const split = weekdayWeekendSplit(
        report.trend.grouping,
        report.trend.points,
    );
    const right = PAGE.margin + HALF + 8;
    page.heading('Where the sales come from', 'Share of net sales', 40);
    const top = page.y + 1;
    page.y = top;
    page.chartTitle('By company', PAGE.margin);
    const companyBottom = donutWithLegend(
        doc,
        topSlices(
            report.byCompany,
            (c) => c.company,
            (c) => c.sales,
        ),
        PAGE.margin,
        top + 4,
        HALF,
        { radius: 14 },
    );
    let splitBottom = companyBottom;

    if (split) {
        page.chartTitle('Weekdays vs weekends', right);
        splitBottom = donutWithLegend(
            doc,
            topSlices(
                [
                    { name: 'Weekdays', value: split.weekday.sales },
                    { name: 'Weekends', value: split.weekend.sales },
                ],
                (s) => s.name,
                (s) => s.value,
            ),
            right,
            top + 4,
            HALF,
            { radius: 14 },
        );
        doc.setFontSize(7).setTextColor(MUTED);
        doc.text(
            `Per day: weekdays ${peso(split.weekday.average)} (${split.weekday.days} days), weekends ${peso(split.weekend.average)} (${split.weekend.days} days).`,
            right,
            splitBottom + 1,
        );
        splitBottom += 3;
    }

    page.y = Math.max(companyBottom, splitBottom) + 2;
    doc.setTextColor(INK);
}
