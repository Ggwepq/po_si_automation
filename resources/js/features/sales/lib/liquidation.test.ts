import { unzipSync, strFromU8 } from 'fflate';
import { describe, expect, it } from 'vitest';
import {
    ewtByMonth,
    liquidationByChain,
    liquidationByPeriod,
    liquidationByStore,
    liquidationTotals,
    liquidationWorkbook,
    periodLabel,
    shortPeriodLabel,
} from './liquidation';
import type { Liquidation } from './types';

const liquidation = (over: Partial<Liquidation>): Liquidation => ({
    id: 1,
    periodStart: '2026-11-01',
    periodEnd: '2026-11-15',
    centerCode: '8888',
    centerName: 'SVI HEADOFFICE',
    chain: 'SVI',
    paymentTerm: 'PT38',
    sales: 1000,
    vat: 120,
    amountPayable: 1120,
    ewt: 10,
    netDue: 1110,
    dsrSales: 1000,
    dsrDifference: 0,
    dsrMatches: true,
    csrImported: false,
    paid: 0,
    balance: 1110,
    status: 'unpaid',
    payments: [],
    stores: [
        {
            code: '0006',
            name: 'SVI NORTH EDSA',
            smSales: 1000,
            vat: 120,
            totalSales: 1120,
            dsrSales: 1000,
            difference: 0,
            missingDays: [],
            csrSales: null,
        },
    ],
    ...over,
});

const list = [
    liquidation({}),
    liquidation({
        id: 2,
        chain: 'SSM',
        ewt: 5,
        netDue: 555,
        sales: 500,
        paid: 555,
        balance: 0,
        status: 'paid',
    }),
    liquidation({
        id: 3,
        periodStart: '2026-10-16',
        periodEnd: '2026-10-31',
        ewt: 8,
        netDue: 888,
        balance: 888,
        sales: 800,
        dsrMatches: false,
    }),
];

describe('liquidation summaries', () => {
    it('labels half-month periods', () => {
        expect(periodLabel('2026-11-01', '2026-11-15')).toBe('Nov 1–15, 2026');
        expect(shortPeriodLabel('2026-11-01', '2026-11-15')).toBe('Nov 1–15');
    });

    it('aggregates chart series by period, chain and store', () => {
        expect(liquidationByPeriod(list)).toEqual([
            {
                key: '2026-10-16|2026-10-31',
                label: 'Oct 16–31',
                netDue: 888,
                paid: 0,
                outstanding: 888,
                sales: 800,
                dsrSales: 1000,
            },
            {
                key: '2026-11-01|2026-11-15',
                label: 'Nov 1–15',
                netDue: 1665,
                paid: 555,
                outstanding: 1110,
                sales: 1500,
                dsrSales: 2000,
            },
        ]);

        expect(liquidationByChain(list)).toEqual([
            { name: 'SVI', value: 1998, share: 78.26 },
            { name: 'SSM', value: 555, share: 21.74 },
        ]);

        expect(liquidationByStore(list)).toEqual([
            { name: 'SVI NORTH EDSA', value: 3000, share: 100 },
        ]);
    });

    it('totals what is due, received and outstanding', () => {
        expect(liquidationTotals(list)).toEqual({
            sales: 2300,
            netDue: 2553,
            ewt: 23,
            paid: 555,
            outstanding: 1998,
            unpaidCount: 2,
            dsrIssues: 1,
            dsrMissing: 0,
        });
    });

    it('adds withholding tax up by month and chain', () => {
        const months = ewtByMonth(list);

        expect(months.map((m) => m.month)).toEqual(['2026-11', '2026-10']);
        expect(months[0].ewt).toBe(15);
        expect(months[0].chains).toEqual({
            SVI: { sales: 1000, ewt: 10, netDue: 1110 },
            SSM: { sales: 500, ewt: 5, netDue: 555 },
        });
    });
});

describe('liquidationWorkbook', () => {
    it('writes the liquidations, stores and EWT sheets with totals', () => {
        const files = unzipSync(liquidationWorkbook(list, 'Oroza Enterprise'));
        const workbook = strFromU8(files['xl/workbook.xml']);
        const first = strFromU8(files['xl/worksheets/sheet1.xml']);

        expect(workbook).toContain('name="Liquidations"');
        expect(workbook).toContain('name="Stores"');
        expect(workbook).toContain('name="EWT by month"');
        // Net amount due total: SUM over the three rows.
        expect(first).toContain('<f>SUM(I4:I6)</f>');
    });
});
