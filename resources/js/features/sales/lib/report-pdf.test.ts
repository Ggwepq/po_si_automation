import { describe, expect, it } from 'vitest';
import { reconciliation } from './reconciliation.fixture';
import { buildReportPdf, fitInside } from './report-pdf';
import type { ReportPeriod, SalesReport, SalesTotals } from './types';

const totals = (sales: number): SalesTotals => ({
    totalSales: sales,
    totalQty: 40,
    itemCount: 30,
    storeCount: 2,
    salesDays: 1,
    averageDailySales: sales,
    grossProfit: null,
    grossMargin: null,
    costCoverage: 0,
});

const items = Array.from({ length: 30 }, (_, i) => ({
    code: `A${i}`,
    description: `DEMO ITEM ${i}`,
    uom: 'PC',
    qty: 30 - i,
    sales: (30 - i) * 10,
    share: 3.33,
    averagePrice: 10,
    grossProfit: null,
    grossMargin: null,
    costCoverage: 0,
    storeCount: 2,
}));

const report: SalesReport = {
    summary: { ...totals(4650), previous: totals(4000) },
    byCompany: [
        { company: 'SVI', sales: 4650, qty: 465, storeCount: 2, share: 100 },
    ],
    byStore: [
        {
            code: '0001',
            name: 'SVI DEMO NORTH',
            company: 'SVI',
            sales: 3000,
            qty: 300,
            itemCount: 30,
            share: 64.5,
            topItem: 'DEMO ITEM 0',
            grossProfit: null,
            grossMargin: null,
            costCoverage: 0,
        },
        {
            code: '0002',
            name: 'SVI DEMO SOUTH',
            company: 'SVI',
            sales: 1650,
            qty: 165,
            itemCount: 20,
            share: 35.5,
            topItem: 'DEMO ITEM 1',
            grossProfit: null,
            grossMargin: null,
            costCoverage: 0,
        },
    ],
    items,
    trend: {
        grouping: 'day',
        points: [
            { date: '2026-11-09', sales: 2000, qty: 200 },
            { date: '2026-11-10', sales: 2650, qty: 265 },
        ],
    },
};

const period = {
    type: 'weekly',
    start: '2026-11-09',
    end: '2026-11-15',
    label: 'Nov 9 - Nov 15, 2026',
    days: 7,
    previous: {
        start: '2026-11-02',
        end: '2026-11-08',
        label: 'Nov 2 - Nov 8, 2026',
    },
    next: {
        start: '2026-11-16',
        end: '2026-11-22',
        label: 'Nov 16 - Nov 22, 2026',
    },
} as ReportPeriod;

describe('buildReportPdf', () => {
    it('builds an A4 report with highlights, figures, charts and tables', () => {
        const doc = buildReportPdf({
            report,
            period,
            scope: 'All stores',
            companyName: 'Oroza Enterprise',
            generatedAt: '2026-11-11T10:00:00+08:00',
        });
        const content = doc.output();

        expect(content.startsWith('%PDF-')).toBe(true);
        expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(2);

        for (const text of [
            'WEEKLY SALES REPORT',
            'Performance at a glance',
            'Key takeaways',
            'Where the sales come from',
            'Store performance',
            'Store scorecard',
            'Product performance',
            'Top 10 products',
            'Slow movers',
            'Appendix',
            'Data quality',
            'Page 1 of',
        ]) {
            expect(content, text).toContain(text);
        }

        expect(content).toContain('+16.3% vs Nov 2 - Nov 8, 2026');
        expect(content).toContain('4,650.00');
        // Pie charts only: no bar or line chart titles.
        expect(content).not.toContain('Daily sales (PHP)');
    });

    it('adds the month-end check with the store-days to fix', () => {
        const content = buildReportPdf({
            report,
            period,
            scope: 'All stores',
            companyName: 'Oroza Enterprise',
            generatedAt: '2026-11-11T10:00:00+08:00',
            reconciliation: reconciliation(),
        }).output();

        expect(content).toContain('Month-end check');
        expect(content).toContain('DSR not imported');
        expect(content).toContain('SVI DEMO NORTH \\(0001\\)');
    });

    it('opens the print dialog when asked', () => {
        const doc = buildReportPdf({
            report,
            period,
            scope: 'All stores',
            companyName: 'Oroza Enterprise',
            generatedAt: '2026-11-11T10:00:00+08:00',
            autoPrint: true,
        });

        // jsPDF adds an "open action" that runs the viewer's Print command.
        expect(doc.output()).toMatch(/\/N \/Print/);
    });
});

describe('fitInside', () => {
    it('keeps a wide logo inside the width', () => {
        expect(fitInside({ width: 234, height: 72 }, 32, 18)).toEqual({
            width: 32,
            height: (72 * 32) / 234,
        });
    });

    it('keeps a tall logo inside the height', () => {
        expect(fitInside({ width: 146, height: 135 }, 32, 18)).toEqual({
            width: (146 * 18) / 135,
            height: 18,
        });
    });
});
