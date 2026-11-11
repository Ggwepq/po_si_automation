import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { reportWorkbook } from './export-report';
import type { ReportPeriod, SalesReport, SalesTotals } from './types';

const totals = (sales: number): SalesTotals => ({
    totalSales: sales,
    totalQty: 10,
    itemCount: 2,
    storeCount: 1,
    salesDays: 1,
    averageDailySales: sales,
});

const report: SalesReport = {
    summary: { ...totals(300), previous: totals(200) },
    byCompany: [
        { company: 'SVI', sales: 300, qty: 10, storeCount: 1, share: 100 },
    ],
    byStore: [
        {
            code: '0001',
            name: 'SVI MANILA',
            company: 'SVI',
            sales: 300,
            qty: 10,
            itemCount: 2,
            share: 100,
            topItem: 'Latte',
        },
    ],
    items: [
        {
            code: 'A1',
            description: 'Latte',
            uom: 'PC',
            qty: 8,
            sales: 240,
            share: 80,
            averagePrice: 30,
            storeCount: 1,
        },
        {
            code: 'A2',
            description: 'Mocha',
            uom: null,
            qty: 2,
            sales: 60,
            share: 20,
            averagePrice: 30,
            storeCount: 1,
        },
    ],
    trend: {
        grouping: 'day',
        points: [{ date: '2026-11-10', sales: 300, qty: 10 }],
    },
};

const period = {
    type: 'daily',
    start: '2026-11-10',
    end: '2026-11-10',
    label: 'November 10, 2026',
} as ReportPeriod;

describe('reportWorkbook', () => {
    it('writes one sheet per report section with ranked items', () => {
        const bytes = XLSX.write(reportWorkbook(report, period, 'All stores'), {
            type: 'buffer',
            bookType: 'xlsx',
        });
        const workbook = XLSX.read(bytes);
        const rows = (name: string) =>
            XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[name], {
                header: 1,
            });

        expect(workbook.SheetNames).toEqual([
            'Summary',
            'Items',
            'Stores',
            'Companies',
            'Trend',
        ]);
        expect(rows('Summary')[5]).toEqual([
            'Total sales (excl. VAT)',
            300,
            200,
        ]);
        expect(rows('Items')[1]).toEqual([
            1,
            'A1',
            'Latte',
            'PC',
            8,
            240,
            80,
            30,
            1,
        ]);
        expect(rows('Items')[2][3]).toBe('');
        expect(rows('Stores')[1][7]).toBe('Latte');
    });
});
