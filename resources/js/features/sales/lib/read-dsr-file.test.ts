import { describe, expect, it } from 'vitest';
import { assertDsrFile, previewTotals, toBatches } from './read-dsr-file';
import type { DsrReportInput } from './types';

const report = (
    site: string,
    date: string,
    sales: string[],
): DsrReportInput => ({
    site_code: site,
    site_name: site,
    company: 'SVI',
    transaction_date: date,
    data_status: null,
    lines: sales.map((total, i) => ({
        article_code: `A${i}`,
        description: 'Item',
        barcode: null,
        uom: null,
        sales_qty: '1',
        vat_exempt_sales: '0',
        vatable_sales: total,
        total_sales: total,
    })),
});

describe('DSR file helpers', () => {
    it('accepts DSR exports only', () => {
        expect(() =>
            assertDsrFile({ name: 'dsr.xlsx', size: 10 }),
        ).not.toThrow();
        expect(() =>
            assertDsrFile({ name: 'dsr.csv', size: 10 }),
        ).not.toThrow();
        expect(() => assertDsrFile({ name: 'dsr.pdf', size: 10 })).toThrow(
            /\.xlsx/,
        );
        expect(() =>
            assertDsrFile({ name: 'dsr.xlsx', size: 60 * 1024 * 1024 }),
        ).toThrow(/50 MB/);
    });

    it('splits reports into batches', () => {
        const reports = Array.from({ length: 7 }, (_, i) =>
            report(`S${i}`, '2026-11-10', ['1']),
        );

        expect(toBatches(reports, 3).map((b) => b.length)).toEqual([3, 3, 1]);
    });

    it('summarises a parsed file before import', () => {
        expect(
            previewTotals([
                report('S1', '2026-11-10', ['10.50', '4.50']),
                report('S2', '2026-11-08', ['5']),
                report('S1', '2026-11-09', ['1']),
            ]),
        ).toEqual({
            reportCount: 3,
            storeCount: 2,
            lineCount: 4,
            totalSales: 21,
            firstDate: '2026-11-08',
            lastDate: '2026-11-10',
        });
    });
});
