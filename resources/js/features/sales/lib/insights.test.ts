import { describe, expect, it } from 'vitest';
import { buildInsights } from './insights';
import type { DsrCoverage, SalesReport, SalesTotals } from './types';

const totals = (sales: number): SalesTotals => ({
    totalSales: sales,
    totalQty: 100,
    itemCount: 4,
    storeCount: 3,
    salesDays: 1,
    averageDailySales: sales,
    grossProfit: null,
    grossMargin: null,
    costCoverage: 0,
});

const store = (code: string, sales: number, share: number) => ({
    code,
    name: `STORE ${code}`,
    company: code === 'C' ? 'SMCo' : 'SVI',
    sales,
    qty: 10,
    itemCount: 2,
    share,
    topItem: 'LATTE',
    grossProfit: null,
    grossMargin: null,
    costCoverage: 0,
});

const item = (code: string, sales: number, share: number) => ({
    code,
    description: code,
    uom: 'PC',
    qty: 10,
    sales,
    share,
    averagePrice: sales / 10,
    grossProfit: null,
    grossMargin: null,
    costCoverage: 0,
    storeCount: 2,
});

const report: SalesReport = {
    summary: { ...totals(1000), previous: totals(800) },
    byCompany: [
        { company: 'SVI', sales: 900, qty: 90, storeCount: 2, share: 90 },
        { company: 'SMCo', sales: 100, qty: 10, storeCount: 1, share: 10 },
    ],
    byStore: [store('A', 600, 60), store('B', 300, 30), store('C', 100, 10)],
    items: [
        item('LATTE', 500, 50),
        item('MOCHA', 300, 30),
        item('TEA', 150, 15),
        item('TARO', 50, 5),
    ],
    trend: { grouping: 'day', points: [] },
};

const options = {
    previousLabel: 'October 2026',
    money: (v: number) => `P${v}`,
    qty: (v: number) => String(v),
};

describe('buildInsights', () => {
    it('summarises the period for management', () => {
        const insights = buildInsights(report, options);
        const byTitle = Object.fromEntries(insights.map((i) => [i.title, i]));

        expect(byTitle['Total sales']).toMatchObject({
            text: 'P1000, up 25% vs October 2026 (P800).',
            tone: 'positive',
        });
        expect(byTitle['Best store'].text).toBe(
            'STORE A: P600 (60% of sales), led by LATTE.',
        );
        expect(byTitle['Best-selling item'].text).toBe(
            'LATTE: 10 units, P500 (50% of sales), sold in 2 stores.',
        );
        expect(byTitle['Leading company'].text).toBe(
            'SVI stores brought in 90% of sales (P900).',
        );
        expect(byTitle['Lowest store'].text).toContain(
            'STORE C: P100 (10% of sales)',
        );
        expect(byTitle['Concentration'].text).toBe(
            'The top 3 of 4 items make up 95% of sales.',
        );
    });

    it('reports a decline and the lack of comparison data plainly', () => {
        const down = buildInsights(
            { ...report, summary: { ...totals(600), previous: totals(800) } },
            options,
        );
        const noPrevious = buildInsights(
            { ...report, summary: { ...totals(600), previous: totals(0) } },
            options,
        );

        expect(down[0]).toMatchObject({
            text: 'P600, down 25% vs October 2026 (P800).',
            tone: 'negative',
        });
        expect(noPrevious[0].text).toContain(
            'no data for October 2026 to compare',
        );
    });

    it('warns when days have no imported DSR', () => {
        const coverage = {
            daysWithoutAnyDsr: ['2026-11-01', '2026-11-02'],
        } as DsrCoverage;
        const last = buildInsights(report, { ...options, coverage }).at(-1);

        expect(last).toMatchObject({ title: 'Data check', tone: 'warning' });
        expect(last?.text).toContain(
            '2 days in this period have no imported DSR',
        );
    });

    it('says so when there are no sales', () => {
        const empty = {
            ...report,
            summary: { ...totals(0), previous: totals(0) },
            items: [],
            byStore: [],
            byCompany: [],
        };

        expect(buildInsights(empty, options)).toEqual([
            {
                title: 'No sales',
                text: 'No sales were imported for this period.',
                tone: 'warning',
            },
        ]);
    });
});
