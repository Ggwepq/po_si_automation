import { strFromU8, unzipSync } from 'fflate';
import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { columnName, excelDate, writeXlsx } from './xlsx-writer';
import type { Cell } from './xlsx-writer';

const row = (cells: [number, Cell][]) => new Map(cells);

describe('xlsx-writer', () => {
    const bytes = writeXlsx([
        {
            name: 'MONTHLY SALES NOVEMBER',
            cells: new Map([
                [
                    0,
                    row([
                        [
                            1,
                            {
                                value: 'H&F SALES REPORT',
                                style: {
                                    font: {
                                        name: 'Arial Black',
                                        size: 48,
                                        color: '1F497D',
                                    },
                                    fill: 'FDE9D9',
                                },
                            },
                        ],
                    ]),
                ],
                [
                    1,
                    row([
                        [
                            1,
                            {
                                value: excelDate('2026-11-01'),
                                style: { numFmt: 'mm-dd-yy' },
                            },
                        ],
                        [2, { value: 3 }],
                        [3, { value: 4.5 }],
                    ]),
                ],
                [2, row([[2, { formula: 'SUM(C2,D2)', value: 7.5 }]])],
            ]),
            merges: ['B1:D1'],
            columnWidths: new Map([[1, 56.78]]),
            rowHeights: new Map([[0, 51.6]]),
            frozenColumns: 2,
            zoom: 50,
        },
    ]);

    it('names columns like Excel', () => {
        expect([
            columnName(0),
            columnName(25),
            columnName(26),
            columnName(27),
        ]).toEqual(['A', 'Z', 'AA', 'AB']);
    });

    it('stores dates as Excel serial numbers', () => {
        expect(excelDate('2026-11-01')).toBe(46327);
    });

    it('writes values, formulas, merges and sizes that Excel readers understand', () => {
        const ws = XLSX.read(bytes).Sheets['MONTHLY SALES NOVEMBER'];

        expect(ws.B1.v).toBe('H&F SALES REPORT');
        expect(ws.B2.v).toBe(46327);
        expect(ws.C3.f).toBe('SUM(C2,D2)');
        expect(ws.C3.v).toBe(7.5);
        expect(ws['!merges']).toEqual([XLSX.utils.decode_range('B1:D1')]);
    });

    it('writes the styles', () => {
        const files = unzipSync(bytes);
        const styles = strFromU8(files['xl/styles.xml']);
        const sheet = strFromU8(files['xl/worksheets/sheet1.xml']);

        expect(styles).toContain('<name val="Arial Black"/>');
        expect(styles).toContain('<fgColor rgb="FFFDE9D9"/>');
        expect(styles).toContain('formatCode="mm-dd-yy"');
        expect(sheet).toContain('zoomScale="50"');
        expect(sheet).toContain('<pane xSplit="2" topLeftCell="C1"');
        expect(sheet).toContain('<row r="1" ht="51.6" customHeight="1">');
    });
});
