import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import {
    costsToImport,
    findCostTables,
    guessCostColumn,
} from './parse-cost-file';

/** Shaped like the H&F cost sheet: a title, an "SM | H & F" band, then the table. */
function workbook(): XLSX.WorkBook {
    const book = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
        [null, null, 'VENDOR CODE:', '80369 H & F HERBS AND FRUITS INC.'],
        [null, null, null, null, null, null, 'SM', null, null, 'H & F'],
        [
            null,
            null,
            'ARTICLE CODE',
            'DESCRIPTION',
            'UOM',
            'CATEGORY',
            'RETAIL PRICE',
            'SM COST',
            'MARGIN',
            'FG',
            'GP',
        ],
        [
            null,
            null,
            '20529941',
            'H & F-POTTED_HERBS 40',
            'PC',
            'PLANTS',
            40,
            27.5,
            0.3125,
            16.42,
            11.08,
        ],
        [
            null,
            null,
            20540460,
            'H & F-CHERRY_TOMATO-200G',
            'PC',
            'SALADS',
            60,
            48,
            0.2,
            30,
            18,
        ],
        // No FG cost yet: skipped.
        [
            null,
            null,
            '20542960',
            'H & F-RED_BELL PEPPER',
            'KG',
            'SALADS',
            240,
            192,
            0.2,
            null,
            192,
        ],
        [],
        // A second table with no cost-like column.
        ['KG', 'QTY', 'ARTICLE CODE', 'DESCRIPTION', 'H & F', 'SM'],
        [25, 8, 20589631, 'H & F MONGGO KINTAB 250G', 31.5, 30.5],
        [null, null, 'ITEM', 'QTY'],
    ]);
    XLSX.utils.book_append_sheet(book, sheet, 'PRODUCT');

    return book;
}

describe('findCostTables', () => {
    it('finds each article code table and guesses the FG cost column', () => {
        const [product, monggo] = findCostTables(workbook());

        expect(product.label).toBe('PRODUCT, row 3');
        expect(product.rows.map((r) => r.code)).toEqual([
            '20529941',
            '20540460',
            '20542960',
        ]);
        expect(
            product.columns.find((c) => c.index === product.costColumn)?.label,
        ).toBe('FG');
        expect(product.rows[0].values[product.costColumn!]).toBe(16.42);

        expect(monggo.rows).toHaveLength(1);
        expect(monggo.costColumn).toBeNull();
    });
});

describe('guessCostColumn', () => {
    it('prefers a vendor cost over SM COST', () => {
        expect(
            guessCostColumn([
                { index: 1, label: 'SM COST' },
                { index: 2, label: 'UNIT COST' },
            ]),
        ).toBe(2);
        expect(guessCostColumn([{ index: 1, label: 'SM COST' }])).toBeNull();
    });
});

describe('costsToImport', () => {
    it('takes positive costs from the chosen columns and skips the rest', () => {
        const tables = findCostTables(workbook());

        expect(
            costsToImport(
                tables,
                tables.map((t) => t.costColumn),
            ),
        ).toEqual([
            {
                article_code: '20529941',
                unit_cost: '16.42',
                description: 'H & F-POTTED_HERBS 40',
            },
            {
                article_code: '20540460',
                unit_cost: '30',
                description: 'H & F-CHERRY_TOMATO-200G',
            },
        ]);
    });

    it('uses another column when chosen', () => {
        const tables = findCostTables(workbook());

        expect(costsToImport(tables, [null, 4])).toEqual([
            {
                article_code: '20589631',
                unit_cost: '31.5',
                description: 'H & F MONGGO KINTAB 250G',
            },
        ]);
    });
});
