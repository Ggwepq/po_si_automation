import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import {
    matchRA,
    parseICRSheet,
    parseRASheet,
    readRAWorkbook,
} from './ra-matching';

function book(sheets: Record<string, unknown[][]>): XLSX.WorkBook {
    const workbook = XLSX.utils.book_new();

    for (const [name, values] of Object.entries(sheets)) {
        XLSX.utils.book_append_sheet(
            workbook,
            XLSX.utils.aoa_to_sheet(values),
            name,
        );
    }

    return workbook;
}

const icrSheets = (workbook: XLSX.WorkBook) =>
    workbook.SheetNames.map((name) => parseICRSheet(workbook, name));

const fakeFile = (workbook: XLSX.WorkBook, name = 'ICR.xlsx') => {
    const bytes = XLSX.write(workbook, {
        type: 'array',
        bookType: 'xlsx',
    }) as ArrayBuffer;

    return { name, size: bytes.byteLength, arrayBuffer: async () => bytes };
};

describe('matchRA', () => {
    it('searches selected months first, falls back elsewhere, deduplicates codes, and preserves exact identifiers', () => {
        const ra = parseRASheet(
            book({
                RA: [
                    ['Document Reference', 'item'],
                    [' 15305 ', 'ice'],
                    ['001', 'old'],
                    ['1', ''],
                    ['SI-1', ''],
                    ['', 'keep'],
                ],
            }),
            'RA',
        );
        const sheets = icrSheets(
            book({
                August: [
                    ['S.I. #', 'CODE'],
                    [15305, 'ICE'],
                    [15305, 'ICE'],
                    ['1', 'ONE'],
                ],
                September: [
                    ['CODE', 'SI NO.'],
                    ['ZERO', '001'],
                    ['PREFIX', 'SI-1'],
                ],
            }),
        );

        const august = matchRA(ra, sheets, ['August']);

        expect(august.map((r) => r.status)).toEqual([
            'Matched',
            'Matched',
            'Matched',
            'Matched',
            'Needs review',
        ]);
        expect(august.map((r) => r.outputItem)).toEqual([
            'ICE',
            'ZERO',
            'ONE',
            'PREFIX',
            'keep',
        ]);
        expect(august.map((r) => r.fallback)).toEqual([
            false,
            true,
            false,
            true,
            false,
        ]);
        expect(august[0].months).toEqual(['August']);

        const both = matchRA(ra, sheets, ['August', 'September']);

        expect(both[1].outputItem).toBe('ZERO');
        expect(both[3].outputItem).toBe('PREFIX');
        expect(both[1].fallback).toBe(false);
    });

    it('gives selected-month matches priority; fallback exposes conflicts or blanks', () => {
        const ra = parseRASheet(
            book({
                RA: [
                    ['Document Reference', 'ITEM'],
                    ['1', 'old1'],
                    ['2', 'old2'],
                    ['3', 'old3'],
                    ['4', 'old4'],
                ],
            }),
            'RA',
        );
        const sheets = icrSheets(
            book({
                January: [
                    ['SI No.', 'CODE'],
                    ['1', 'PRIORITY'],
                ],
                February: [
                    ['SI No.', 'CODE'],
                    ['1', 'OTHER'],
                    ['2', 'A'],
                    ['3', ''],
                ],
                Archive: [
                    ['SI No.', 'CODE'],
                    ['2', 'B'],
                ],
            }),
        );

        const results = matchRA(ra, sheets, ['January']);

        expect(results[0]).toMatchObject({
            code: 'PRIORITY',
            fallback: false,
            months: ['January'],
        });
        expect(results[1]).toMatchObject({
            status: 'Needs review',
            outputItem: 'old2',
            fallback: true,
            months: ['February', 'Archive'],
        });
        expect(results[2]).toMatchObject({
            status: 'Needs review',
            outputItem: 'old3',
        });
        expect(results[3]).toMatchObject({
            status: 'Not matched',
            outputItem: 'old4',
        });
        expect(results[3].reason).toMatch(/anywhere in the ICR/);
    });

    it('requires review for conflicts across months and blank codes, keeping current ITEM', () => {
        const ra = parseRASheet(
            book({
                RA: [
                    ['Document Reference', 'ITEM'],
                    ['1', 'keep1'],
                    ['2', 'keep2'],
                    ['3', 'keep3'],
                ],
            }),
            'RA',
        );
        const sheets = icrSheets(
            book({
                Jan: [
                    ['SI No.', 'CODE'],
                    ['1', 'A'],
                    ['2', 'A'],
                    ['2', ''],
                    ['3', ''],
                ],
                Feb: [
                    ['S.I.#', 'Code'],
                    ['1', 'B'],
                ],
            }),
        );

        const result = matchRA(ra, sheets, ['Jan', 'Feb']);

        expect(result.every((r) => r.status === 'Needs review')).toBe(true);
        expect(result.map((r) => r.outputItem)).toEqual([
            'keep1',
            'keep2',
            'keep3',
        ]);
        expect(result[0].reason).toMatch(/Conflicting codes: A, B/);
        expect(result[1].reason).toMatch(/blank CODE/);
    });
});

describe('parseRASheet', () => {
    it('places a missing ITEM after all existing data', () => {
        const ra = parseRASheet(
            book({
                RA: [['Document Reference'], ['123', '', 'unlabelled data']],
            }),
            'RA',
        );

        expect(ra.hasItem).toBe(false);
        expect(ra.itemColumn).toBe(3);
    });

    it('uses true Excel row positions for offset tables', () => {
        const workbook = XLSX.utils.book_new();
        const sheet: XLSX.WorkSheet = {};
        XLSX.utils.sheet_add_aoa(
            sheet,
            [
                ['Document Reference', 'ITEM'],
                ['123', ''],
            ],
            { origin: 'C5' },
        );
        XLSX.utils.book_append_sheet(workbook, sheet, 'Offset');

        const parsed = parseRASheet(workbook, 'Offset');

        expect(parsed.headerRow).toBe(4);
        expect(parsed.rows[0].rowIndex).toBe(5);
        expect(parsed.referenceColumn).toBe(2);
    });

    it('rejects ambiguous headers, missing headers, and empty sheets', () => {
        expect(() =>
            parseRASheet(
                book({
                    RA: [
                        ['Document Reference', 'Document Reference'],
                        ['1', '2'],
                    ],
                }),
                'RA',
            ),
        ).toThrow(/duplicate/);
        expect(() =>
            parseRASheet(book({ RA: [['Document Reference', 'ITEM']] }), 'RA'),
        ).toThrow(/no RA detail rows/);
        expect(() =>
            parseICRSheet(
                book({
                    Jan: [
                        ['SI No.', 'CODE', 'Code'],
                        ['1', 'A', 'B'],
                    ],
                }),
                'Jan',
            ),
        ).toThrow(/duplicate/);
        expect(() =>
            parseICRSheet(book({ Jan: [['SI No.'], ['1']] }), 'Jan'),
        ).toThrow(/No SI No. and CODE/);
    });
});

describe('readRAWorkbook', () => {
    it('discovers compatible sheets, reports excluded sheets, and validates input files', async () => {
        const parsed = await readRAWorkbook(
            fakeFile(
                book({
                    Overview: [['Title']],
                    August: [
                        ['SI NO.', 'CODE'],
                        ['1', 'A'],
                    ],
                    September: [['CODE', 'S.I. #']],
                }),
            ),
            'icr',
        );

        expect(parsed.sheets.map((s) => s.sheetName)).toEqual([
            'August',
            'September',
        ]);
        expect(parsed.skippedSheets[0].name).toBe('Overview');

        const noBytes = async () => new ArrayBuffer(0);
        await expect(
            readRAWorkbook(
                { name: 'file.csv', size: 1, arrayBuffer: noBytes },
                'ra',
            ),
        ).rejects.toThrow(/xlsx/);
        await expect(
            readRAWorkbook(
                {
                    name: 'file.xlsx',
                    size: 101 * 1024 * 1024,
                    arrayBuffer: noBytes,
                },
                'ra',
            ),
        ).rejects.toThrow(/100 MB/);
    });

    it('skips an unrelated overview and reads monthly records beyond the header scan', async () => {
        const parsed = await readRAWorkbook(
            fakeFile(
                book({
                    Overview: [['Title']],
                    January: [
                        ['SI No.', 'CODE'],
                        ...Array.from({ length: 40 }, (_, i) => [
                            `SI${i}`,
                            'A',
                        ]),
                    ],
                }),
            ),
            'icr',
        );

        expect(parsed.skippedSheets[0].name).toBe('Overview');
        expect(parsed.sheets[0].rows).toHaveLength(40);
        expect(parsed.sheets[0].rows.at(-1)?.si).toBe('SI39');
    });
});
