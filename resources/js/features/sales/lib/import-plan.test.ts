import { describe, expect, it } from 'vitest';
import { batchesOf, importFacts } from './import-plan';
import type { LiquidationInput, ParsedClrFile } from './types';

const limits = {
    reportsPerBatch: 2,
    linesPerReport: 10,
    summariesPerBatch: 2,
    csrStoresPerBatch: 2,
    liquidationsPerBatch: 2,
};

const liquidation = (
    chain: string,
    start: string,
    end: string,
    net: string,
): LiquidationInput => ({
    vendor_code: '150551',
    vendor_name: 'OROZA ENTERPRISES',
    center_code: chain === 'SVI' ? '8888' : '0100',
    center_name: `${chain} HEADOFFICE`,
    chain,
    payment_term: 'PT38',
    period_start: start,
    period_end: end,
    amount_payable: net,
    ewt: '0',
    net_due: net,
    stores: [
        {
            site_code: '0006',
            site_name: 'X',
            company: chain,
            vat_exempt_sales: '0',
            vatable_sales: '1',
            vat_amount: '0',
            total_sales: '1',
        },
    ],
});

const clr: ParsedClrFile = {
    kind: 'clr',
    warnings: [],
    liquidations: [
        liquidation('SVI', '2026-11-01', '2026-11-15', '116123.26'),
        liquidation('SSM', '2026-11-01', '2026-11-15', '78764.11'),
        liquidation('SVI', '2026-10-16', '2026-10-31', '94560.41'),
    ],
};

describe('import plan', () => {
    it('summarises a liquidation report for review', () => {
        const facts = importFacts(clr);

        expect(facts.action).toBe('Import 3 liquidations');
        expect(Object.fromEntries(facts.facts)).toMatchObject({
            Periods: 'Oct 16–31, 2026, Nov 1–15, 2026',
            'Head offices': 'SSM, SVI',
        });
        expect(facts.firstDate).toBe('2026-10-16');
        expect(facts.lastDate).toBe('2026-11-15');
    });

    it('splits a file into batches of the right kind', () => {
        const batches = batchesOf(clr, limits);

        expect(batches.map((b) => [b.kind, b.rows.length])).toEqual([
            ['clr', 2],
            ['clr', 1],
        ]);
    });
});
