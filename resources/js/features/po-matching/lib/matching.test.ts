import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { compareWorkbooks, summarize } from './matching';
import type { ParsedSheet } from './types';
import { parseSheet, resultsWorkbook } from './workbooks';

type Input = Pick<ParsedSheet, 'poColumn' | 'headers' | 'rows'>;

const po: Input = {
    poColumn: 'PO No.',
    headers: ['PO No.', 'Vendor Code'],
    rows: [
        { 'PO No.': ' PO001 ', 'Vendor Code': '0015' },
        { 'PO No.': 'PO001', 'Vendor Code': '0015' },
        { 'PO No.': 'PO002' },
        { 'PO No.': '' },
    ],
};

const gr: Input = {
    poColumn: 'PO No.',
    headers: ['PO No.', 'Receipt No.'],
    rows: [
        { 'PO No.': 'PO001', 'Receipt No.': 'R1' },
        { 'PO No.': 'PO001', 'Receipt No.': 'R2' },
        { 'PO No.': 'PO003', 'Receipt No.': 'R3' },
        { 'PO No.': '', 'Receipt No.': 'R4' },
    ],
};

describe('compareWorkbooks', () => {
    it('matches across GR rows, preserves repeated PO items, and never matches blank keys', () => {
        const results = compareWorkbooks(po, gr);

        expect(results.map((r) => r.status)).toEqual([
            'Delivered',
            'Delivered',
            'Undelivered',
            'Needs review',
        ]);
        expect(results[0].receiptNumbers).toEqual(['R1', 'R2']);
        expect(results[2].grPO).toBe('');
        expect(summarize(results, gr)).toEqual({
            total: 2,
            delivered: 1,
            undelivered: 1,
            review: 1,
            unmatchedGR: 1,
        });
    });

    it('treats leading zeros and prefixes as significant', () => {
        const result = compareWorkbooks(
            { poColumn: 'p', rows: [{ p: '001' }, { p: 'PO001' }, { p: '1' }] },
            { poColumn: 'p', rows: [{ p: '1' }], headers: [] },
        );

        expect(result.map((r) => r.status)).toEqual([
            'Undelivered',
            'Undelivered',
            'Delivered',
        ]);
    });
});

describe('resultsWorkbook', () => {
    it('keeps all original rows, leading zeros, and literal formula-like text', () => {
        const results = compareWorkbooks(po, gr);
        results[0].original = { ...results[0].original, 'Vendor Code': '=1+1' };

        const bytes = XLSX.write(resultsWorkbook(results, po.headers), {
            type: 'buffer',
            bookType: 'xlsx',
        });
        const sheet = XLSX.read(bytes).Sheets['PO Delivery Results'];
        const data = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });

        expect(data).toHaveLength(5);
        expect(data[1][1]).toBe('=1+1');
        expect(data[2][1]).toBe('0015');
        expect(sheet.B2.f).toBeUndefined();
        expect(data[3][2]).toBe('Undelivered');
        expect(data[3][3]).toBe('');
    });
});

describe('parseSheet', () => {
    it('detects a PO header after introductory rows and rejects sheets without it', () => {
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(
            workbook,
            XLSX.utils.aoa_to_sheet([
                ['Title'],
                ['PO No.', 'Vendor Code'],
                ['001', '0015'],
            ]),
            'Data',
        );

        expect(parseSheet(workbook, 'Data').rows[0]['PO No.']).toBe('001');

        XLSX.utils.book_append_sheet(
            workbook,
            XLSX.utils.aoa_to_sheet([['Something'], ['123']]),
            'Other',
        );

        expect(() => parseSheet(workbook, 'Other')).toThrow(/No PO No./);
    });
});
