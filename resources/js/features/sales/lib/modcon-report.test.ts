import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { modconReport } from './modcon-report';
import type { ModconSummary } from './types';

const halves = (values: Record<number, number>) =>
    Array.from({ length: 24 }, (_, h) => values[h] ?? 0);

const summary: ModconSummary = {
    year: 2026,
    items: [
        { code: '20586495', description: 'FS-HOT_AMERICANO_(VM)' },
        { code: '20586496', description: 'FS-ICED_AMERICANO_(VM)' },
    ],
    chains: [
        {
            chain: 'SSM',
            amount: [halves({ 14: 294.6, 15: 19.64 }), halves({ 14: 19.64 })],
            qty: [halves({ 14: 15, 15: 1 }), halves({ 14: 1 })],
        },
        {
            chain: 'SVI',
            amount: [halves({ 14: 100 }), halves({})],
            qty: [halves({ 14: 5 }), halves({})],
        },
    ],
};

describe('modconReport', () => {
    const workbook = XLSX.read(modconReport('Oroza Enterprise', summary, 7));

    it('has the month, one sheet per chain and the company total', () => {
        expect(workbook.SheetNames).toEqual([
            'AUGUST',
            'SSM',
            'SVI',
            'TOTAL PER COMPANY',
        ]);
    });

    it('lays out a chain sheet like the original', () => {
        const ssm = workbook.Sheets.SSM;

        expect(ssm.A2.v).toBe('SSM MODCON REPORT 2026');
        // Half-month end dates head each Amount/QTY pair.
        expect(ssm.B4.v).toBe(46037); // 2026-01-15
        expect(ssm.C4.v).toBe('QTY');
        expect(ssm.D4.v).toBe(46053); // 2026-01-31
        expect([ssm.AX4.v, ssm.AY4.v, ssm.AZ4.v, ssm.BA4.v]).toEqual([
            'AMOUNT',
            'VAT',
            'TOTAL AMOUNT',
            'TOTAL  QTY',
        ]);
        expect(ssm.A5.v).toBe('OROZA ENTERPRISE');
        expect(ssm.A6.v).toBe('FS-HOT_AMERICANO_(VM)');
        // August 1–15 is the 15th pair: columns AD (amount) and AE (qty).
        expect(ssm.AD6.v).toBe(294.6);
        expect(ssm.AE6.v).toBe(15);
        expect(ssm.AX6.v).toBe(314.24);
        expect(ssm.AY6.f).toBe('AX6*0.12');
        expect(ssm.AZ6.v).toBe(351.95);
        expect(ssm.A8.v).toBe('TOTAL');
        expect(ssm.AD8.f).toBe('SUM(AD6:AD7)');
        expect(ssm.AX8.v).toBe(333.88);
        expect([ssm.A9.v, ssm.A10.v, ssm.A11.v]).toEqual([
            'S.I NUMBER',
            'R.A NUMBER',
            'R.A AMOUNT',
        ]);
    });

    it('adds the chains up with formulas on TOTAL PER COMPANY', () => {
        const total = workbook.Sheets['TOTAL PER COMPANY'];

        expect(total.A2.v).toBe('MODCON REPORT 2026');
        expect(total.AD6.f).toBe("'SSM'!AD6+'SVI'!AD6");
        expect(total.AD6.v).toBe(394.6);
        expect(total.AX8.v).toBe(433.88);
    });

    it('shows the billed month by half, linked to the company total', () => {
        const august = workbook.Sheets.AUGUST;

        expect(august.A2.v).toBe('OROZA ENTERPRISE SALES REPORT 2026');
        expect(august.B4.v).toBe(46249); // 2026-08-15
        expect(august.D4.v).toBe(46265); // 2026-08-31
        expect([august.F4.v, august.G4.v]).toEqual(['TOTAL ', 'TOTAL  QTY']);
        expect(august.B6.f).toBe("'TOTAL PER COMPANY'!AD6");
        expect(august.B6.v).toBe(394.6);
        expect(august.F6.v).toBe(414.24);
        expect(august.G8.v).toBe(22);
    });

    it('leaves out the month sheet for other periods', () => {
        expect(
            XLSX.read(modconReport('Oroza Enterprise', summary)).SheetNames[0],
        ).toBe('SSM');
    });
});
