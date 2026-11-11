import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import {
    parseDate,
    parseDecimal,
    parseDsrWorkbook,
    parseSite,
} from './parse-dsr';

function book(sheets: Record<string, unknown[][]>): XLSX.WorkBook {
    const workbook = XLSX.utils.book_new();

    for (const [name, rows] of Object.entries(sheets)) {
        XLSX.utils.book_append_sheet(
            workbook,
            XLSX.utils.aoa_to_sheet(rows),
            name,
        );
    }

    return workbook;
}

const ITEM_HEADER = [
    'Item No.',
    'Article Code',
    'Description',
    'Barcode',
    'UOM',
    'Sales Qty',
    'VAT-Exempt Sales',
    'VATable Sales',
    'Total Sales Excl VAT',
];

function documentRows(
    site: string,
    date: string,
    lines: unknown[][],
): unknown[][] {
    return [
        ['SUPERVALUE, INC.'],
        ['Vendor Code & Name', '[150551] DEMO VENDOR'],
        ['Site Code & Name', site],
        ['Transaction Date', date],
        [],
        ITEM_HEADER,
        ...lines,
        [
            'Grand Total',
            null,
            null,
            null,
            null,
            null,
            '0.00',
            '100.00',
            '100.00',
        ],
        [],
    ];
}

describe('parseDsrWorkbook', () => {
    it('reads document-layout DSRs, several per sheet', () => {
        const result = parseDsrWorkbook(
            book({
                DSR: [
                    ...documentRows('[1230] SVI AURA PREMIER', '11/10/2026', [
                        [
                            1,
                            20586495,
                            'HOT AMERICANO',
                            2077106592560,
                            'PC',
                            15,
                            0,
                            294.6,
                            294.6,
                        ],
                        [
                            2,
                            20586496,
                            'ICED AMERICANO',
                            2077106592577,
                            'PC',
                            '2.000',
                            '0.00',
                            '39.28',
                            '39.28',
                        ],
                    ]),
                    ...documentRows('[0755] SSM FAIRVIEW', '11/10/2026', [
                        [
                            1,
                            20586495,
                            'HOT AMERICANO',
                            2077106592560,
                            'PC',
                            1,
                            0,
                            '1,019.64',
                            '1,019.64',
                        ],
                    ]),
                ],
            }),
        );

        expect(result.warnings).toEqual([]);
        expect(result.reports).toHaveLength(2);
        expect(result.reports[1]).toMatchObject({
            site_code: '1230',
            site_name: 'SVI AURA PREMIER',
            company: 'SVI',
            transaction_date: '2026-11-10',
        });
        expect(result.reports[1].lines[0]).toEqual({
            article_code: '20586495',
            description: 'HOT AMERICANO',
            barcode: '2077106592560',
            uom: 'PC',
            sales_qty: '15',
            vat_exempt_sales: '0',
            vatable_sales: '294.6',
            total_sales: '294.6',
        });
        expect(result.reports[0].lines[0].total_sales).toBe('1019.64');
    });

    it('reads flat exports with store and date on every row', () => {
        const result = parseDsrWorkbook(
            book({
                Export: [
                    [
                        'Site Code',
                        'Site Name',
                        'Company Name',
                        'Transaction Date',
                        'Article Code',
                        'Description',
                        'Sales Qty',
                        'Total Sales',
                    ],
                    [
                        '0001',
                        'SVI MANILA',
                        'SVI',
                        '2026-11-09',
                        'A1',
                        'Latte',
                        2,
                        60,
                    ],
                    [
                        '0001',
                        'SVI MANILA',
                        'SVI',
                        '2026-11-09',
                        'A2',
                        'Mocha',
                        1,
                        30,
                    ],
                    [
                        '0002',
                        'SMCo FESTIVAL MALL',
                        'SMCo',
                        46336,
                        'A1',
                        'Latte',
                        1,
                        30,
                    ],
                ],
            }),
        );

        expect(
            result.reports.map((r) => [
                r.site_code,
                r.transaction_date,
                r.lines.length,
            ]),
        ).toEqual([
            ['0001', '2026-11-09', 2],
            ['0002', '2026-11-10', 1],
        ]);
        expect(result.reports[1].company).toBe('SMCo');
        expect(result.reports[0].lines[0].vatable_sales).toBe('60');
    });

    it('keeps only the last copy of a store-day exported twice', () => {
        const result = parseDsrWorkbook(
            book({
                DSR: [
                    ...documentRows('[0001] SVI MANILA', '11/10/2026', [
                        [1, 'A1', 'Latte', '', 'PC', 1, 0, 30, 30],
                    ]),
                    ...documentRows('[0001] SVI MANILA', '11/10/2026', [
                        [1, 'A1', 'Latte', '', 'PC', 2, 0, 60, 60],
                    ]),
                ],
            }),
        );

        expect(result.reports).toHaveLength(1);
        expect(result.reports[0].lines).toHaveLength(1);
        expect(result.reports[0].lines[0].sales_qty).toBe('2');
        expect(result.warnings[0]).toMatch(/appears more than once/);
    });

    it('skips lines with unreadable numbers and reports where', () => {
        const result = parseDsrWorkbook(
            book({
                DSR: documentRows('[0001] SVI MANILA', '11/10/2026', [
                    [1, 'A1', 'Latte', '', 'PC', 'n/a', 0, 30, 30],
                    [2, 'A2', 'Mocha', '', 'PC', 1, 0, 30, 30],
                ]),
            }),
        );

        expect(result.reports[0].lines.map((l) => l.article_code)).toEqual([
            'A2',
        ]);
        expect(result.warnings[0]).toMatch(/DSR row 7: skipped/);
    });

    it('explains when the file is not a DSR', () => {
        expect(() =>
            parseDsrWorkbook(book({ Sheet1: [['Hello'], ['World']] })),
        ).toThrow(/No DSR item lines/);
    });
});

describe('value parsing', () => {
    it.each([
        ['1,146.38', '1146.38'],
        ['(12.50)', '-12.5'],
        [294.60000000001, '294.6'],
        ['₱ 1,000', '1000'],
        ['abc', null],
        ['', null],
    ])('decimal %s → %s', (input, expected) => {
        expect(parseDecimal(input)).toBe(expected);
    });

    it('reads portal dates and Excel serials', () => {
        expect(parseDate('11/10/2026')).toBe('2026-11-10');
        expect(parseDate('2026-11-10 00:00:00')).toBe('2026-11-10');
        expect(parseDate(46336)).toBe('2026-11-10');
        expect(parseDate('soon')).toBeNull();
    });

    it('splits "[code] name" store labels', () => {
        expect(parseSite('[1230] SVI AURA PREMIER')).toEqual({
            code: '1230',
            name: 'SVI AURA PREMIER',
        });
        expect(parseSite('')).toBeNull();
    });
});
