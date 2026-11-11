import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import {
    isDsrSummaryWorkbook,
    parseDsrSummaryWorkbook,
} from './parse-dsr-summary';
import { parseSalesWorkbook } from './parse-sales-file';

const book = (rows: unknown[][]): XLSX.WorkBook => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.aoa_to_sheet(rows),
        'Sheet1',
    );

    return workbook;
};

// Same layout as SM's DSRS_DETAIL.xlsx export; values are made up.
const HEADER = [
    'Document Title',
    'Vendor Code',
    'Vendor Name',
    'Site Code',
    'Site Name',
    'Month Of',
    'Item No.',
    'Transaction Date',
    'Total Sales Excl VAT',
    'Important Remarks',
];

const row = (site: string, date: string, total: string, remark = '') => [
    'DSR Summary',
    '900001',
    'DEMO VENDOR',
    site,
    `SVI DEMO STORE ${site}`,
    'Oct 2026',
    '1',
    date,
    total,
    remark,
];

describe('DSR Summary parser', () => {
    it('reads one total per store-day, keeping 0.00 days', () => {
        const result = parseDsrSummaryWorkbook(
            book([
                HEADER,
                row('0002', '10/02/2026', '0.00'),
                row(
                    '0001',
                    '10/01/2026',
                    '1,146.38',
                    'Total figures are not yet final',
                ),
                [
                    'Grand Total',
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    '1,146.38',
                ],
            ]),
        );

        expect(result.kind).toBe('summary');
        expect(result.warnings).toEqual([]);
        expect(result.summaries).toEqual([
            {
                vendor_code: '900001',
                vendor_name: 'DEMO VENDOR',
                site_code: '0001',
                site_name: 'SVI DEMO STORE 0001',
                company: 'SVI',
                transaction_date: '2026-10-01',
                total_sales: '1146.38',
            },
            expect.objectContaining({ site_code: '0002', total_sales: '0' }),
        ]);
    });

    it('warns when the grand total does not match the rows', () => {
        const result = parseDsrSummaryWorkbook(
            book([
                HEADER,
                row('0001', '10/01/2026', '10.00'),
                ['Grand Total', ...Array(7).fill(null), '99.00'],
            ]),
        );

        expect(result.warnings[0]).toMatch(/differs from its rows/);
    });

    it('skips rows without a valid amount and reports them', () => {
        const result = parseDsrSummaryWorkbook(
            book([
                HEADER,
                row('0001', '10/01/2026', 'n/a'),
                row('0002', '10/01/2026', '5.00'),
            ]),
        );

        expect(result.summaries).toHaveLength(1);
        expect(result.warnings[0]).toMatch(/row 2: skipped/);
    });

    it('is told apart from the item-level DSR', () => {
        const detail = book([
            [
                'Vendor Code',
                'Site Code',
                'Transaction Date',
                'Article Code',
                'Sales Qty',
                'Total Sales Excl VAT',
            ],
            ['900001', '0001', '10/01/2026', 'A1', '1', '5.00'],
        ]);

        expect(isDsrSummaryWorkbook(book([HEADER]))).toBe(true);
        expect(isDsrSummaryWorkbook(detail)).toBe(false);
        expect(parseSalesWorkbook(detail).kind).toBe('detail');
        expect(
            parseSalesWorkbook(book([HEADER, row('0001', '10/01/2026', '1')]))
                .kind,
        ).toBe('summary');
    });

    it('rejects a summary without rows', () => {
        expect(() => parseDsrSummaryWorkbook(book([HEADER]))).toThrow(
            /No rows/,
        );
    });
});
