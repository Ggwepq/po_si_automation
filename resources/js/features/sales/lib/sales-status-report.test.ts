import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { salesStatusReport } from './sales-status-report';
import type { ReportPeriod, SalesMatrix } from './types';

const period = {
    type: 'monthly',
    start: '2026-11-01',
    end: '2026-11-30',
    label: 'November 2026',
} as ReportPeriod;

const items = [
    { code: '20586495', description: 'FS-HOT_AMERICANO_(VM)', uom: 'PC' },
    { code: '20586496', description: 'FS-ICED_AMERICANO_(VM)', uom: 'PC' },
];

const matrix: SalesMatrix = {
    grouping: 'day',
    items,
    byDate: [
        { date: '2026-11-01', qty: [2, 1], sales: [39.28, 19.64] },
        { date: '2026-11-02', qty: [0, 3], sales: [0, 58.92] },
    ],
    byStore: [
        {
            code: '1230',
            name: 'SVI AURA PREMIER',
            company: 'SVI',
            qty: [2, 4],
            sales: [39.28, 78.56],
        },
    ],
};

const yearMatrix: SalesMatrix = {
    grouping: 'month',
    items,
    byDate: Array.from({ length: 12 }, (_, m) => ({
        date: `2026-${String(m + 1).padStart(2, '0')}`,
        qty: m === 10 ? [2, 4] : [0, 0],
        sales: m === 10 ? [39.28, 78.56] : [0, 0],
    })),
    byStore: [],
};

describe('salesStatusReport', () => {
    const workbook = XLSX.read(
        salesStatusReport('Oroza Enterprise', period, matrix, yearMatrix),
    );
    const sheet = workbook.Sheets['MONTHLY SALES NOVEMBER'];
    const value = (ref: string) => sheet[ref]?.v;

    it('has the month sheet and the yearly report', () => {
        expect(workbook.SheetNames).toEqual([
            'MONTHLY SALES NOVEMBER',
            'YEARLY REPORT',
        ]);
    });

    it('lays out the title block like the original report', () => {
        expect(value('B1')).toBe('OROZA ENTERPRISE SALES REPORT');
        expect(value('B3')).toBe('Monthly Sales Status Report ');
        expect(value('B4')).toBe('From 11/1/2026-11/30/2026');
        expect(value('B5')).toBe('Date');
        expect(value('C5')).toBe('Sales Detail');
        expect(value('G5')).toBe('Total Qty sales');
        expect(value('H5')).toBe('Total Amount');
        expect([value('C6'), value('D6'), value('E6'), value('F6')]).toEqual([
            'FS-HOT_AMERICANO_(VM)',
            'Price',
            'FS-ICED_AMERICANO_(VM)',
            'Price',
        ]);
        expect(sheet['!merges']).toContainEqual(
            XLSX.utils.decode_range('C5:F5'),
        );
    });

    it('fills each day with quantities, amounts and formula totals', () => {
        expect(value('B7')).toBe(46327);
        expect([value('C7'), value('D7'), value('E7'), value('F7')]).toEqual([
            2, 39.28, 1, 19.64,
        ]);
        // Zero quantities stay blank, as in the original.
        expect(value('C8')).toBeUndefined();
        expect(sheet.G7.f).toBe('SUM(C7,E7)');
        expect(sheet.H7.f).toBe('SUM(D7,F7)');
        expect(value('B9')).toBe('Total');
        expect(sheet.C9.f).toBe('SUM(C7:C8)');
        expect(value('H9')).toBe(117.84);
    });

    it('adds the store table below and the signature lines', () => {
        const cells = Object.keys(sheet).filter((k) => !k.startsWith('!'));
        const storeRow = cells.find((k) => sheet[k].v === 'SVI AURA PREMIER');
        expect(storeRow).toBeDefined();
        expect(cells.some((k) => sheet[k].v === 'STORES')).toBe(true);
        expect(cells.some((k) => sheet[k].v === 'Prepared By')).toBe(true);
    });

    it('lists every month in the yearly report', () => {
        const yearly = workbook.Sheets['YEARLY REPORT'];

        expect(yearly.B3.v).toBe('Yearly Sales Status Report ');
        expect(yearly.B4.v).toBe('From January to December 2026');
        expect(yearly.B7.v).toBe('January');
        expect(yearly.B17.v).toBe('November');
        expect(yearly.H17.v).toBe(117.84);
        expect(yearly.B19.v).toBe('Total');
    });
});
