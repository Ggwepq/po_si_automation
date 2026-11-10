import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import type { Document, Element } from '@xmldom/xmldom';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { buildRAExport } from './ra-export';
import { matchRA, parseRASheet } from './ra-matching';

const xml = (bytes: Uint8Array): Document =>
    new DOMParser().parseFromString(strFromU8(bytes), 'application/xml');

const elements = (doc: Document | Element, tag: string): Element[] =>
    Array.from(doc.getElementsByTagNameNS('*', tag));

const outer = (node: Element | undefined): string | undefined =>
    node && new XMLSerializer().serializeToString(node);

const rowsOf = (sheet: XLSX.WorkSheet) =>
    XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });

function fixture() {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
        ['Title'],
        ['Document Reference', 'Amount', 'ITEM'],
        ['001', 123.45, 'old'],
        ['002', 0, 'keep'],
        ['003', 7, 'old3'],
    ]);
    sheet.B3.z = '#,##0.00';
    sheet.B5 = { t: 'n', f: 'B3+B4', v: 123.45 };
    XLSX.utils.book_append_sheet(workbook, sheet, 'RA Details');
    XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.aoa_to_sheet([['Untouched'], [1]]),
        'Notes',
    );

    const files = unzipSync(
        new Uint8Array(
            XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }),
        ),
    );
    files['xl/worksheets/sheet1.xml'] = strToU8(
        strFromU8(files['xl/worksheets/sheet1.xml'])
            .replace(
                '<sheetData>',
                '<cols><col min="1" max="3" width="28.25" customWidth="1" style="0"/></cols><sheetData>',
            )
            .replace('<row r="3">', '<row r="3" ht="32" customHeight="1">')
            .replace(
                '</worksheet>',
                '<mergeCells count="1"><mergeCell ref="A1:C1"/></mergeCells><autoFilter ref="A2:C5"/><pageMargins left="0.2" right="0.3" top="0.4" bottom="0.5" header="0.1" footer="0.1"/></worksheet>',
            ),
    );
    // Keep an unrelated part byte-for-byte, including binary assets.
    files['xl/media/image1.png'] = Uint8Array.from([137, 80, 78, 71]);

    const sourceBytes = zipSync(files);
    const ra = parseRASheet(workbook, 'RA Details');
    const results = matchRA(
        ra,
        [
            {
                sheetName: 'Jan',
                rows: [
                    { si: '001', code: '=literal & <code>', rowIndex: 1 },
                    { si: '003', code: 'B', rowIndex: 2 },
                ],
            },
        ],
        ['Jan'],
    );

    return { file: { workbook, sourceBytes }, ra, results, files };
}

describe('buildRAExport', () => {
    it('preserves original styles and every unrelated ZIP part byte-for-byte', () => {
        const { file, ra, results, files } = fixture();
        const bytes = buildRAExport(file, ra, results);
        const out = unzipSync(bytes);

        for (const name of Object.keys(files)) {
            if (name !== 'xl/worksheets/sheet1.xml') {
                expect(out[name], name).toEqual(files[name]);
            }
        }

        const before = xml(files['xl/worksheets/sheet1.xml']);
        const after = xml(out['xl/worksheets/sheet1.xml']);

        for (const tag of ['cols', 'mergeCells', 'pageMargins', 'sheetViews']) {
            expect(outer(elements(after, tag)[0]), tag).toBe(
                outer(elements(before, tag)[0]),
            );
        }

        expect(
            elements(after, 'row')
                .find((r) => r.getAttribute('r') === '3')
                ?.getAttribute('ht'),
        ).toBe('32');

        const read = XLSX.read(bytes, { cellNF: true }).Sheets['RA Details'];

        expect(read.C3.v).toBe('=literal & <code>');
        expect(read.C3.f).toBeUndefined();
        expect(read.C4.v).toBe('keep');
        expect(read.B3.z).toBe('#,##0.00');
        expect(read.B5.f).toBe('B3+B4');
    });

    it('removes excluded rows, compacts records, keeps row styles, and moves ranges and formulas', () => {
        const { file, ra, results, files } = fixture();
        const selected = results.filter((r) => r.status === 'Matched');
        const bytes = buildRAExport(file, ra, results, selected);
        const out = unzipSync(bytes);
        const doc = xml(out['xl/worksheets/sheet1.xml']);

        expect(out['xl/styles.xml']).toEqual(files['xl/styles.xml']);
        expect(out['xl/worksheets/sheet2.xml']).toEqual(
            files['xl/worksheets/sheet2.xml'],
        );
        expect(elements(doc, 'row').map((r) => r.getAttribute('r'))).toEqual([
            '1',
            '2',
            '3',
            '4',
        ]);
        expect(elements(doc, 'row')[2].getAttribute('ht')).toBe('32');
        expect(elements(doc, 'dimension')[0].getAttribute('ref')).toBe('A1:C4');
        expect(elements(doc, 'autoFilter')[0].getAttribute('ref')).toBe(
            'A2:C4',
        );

        const read = XLSX.read(bytes).Sheets['RA Details'];

        expect(
            rowsOf(read)
                .slice(2)
                .map((r) => r[0]),
        ).toEqual(['001', '003']);

        const formulaCell = elements(doc, 'c').find(
            (c) => c.getAttribute('r') === 'B4',
        );

        expect(formulaCell && elements(formulaCell, 'f')[0].textContent).toBe(
            'B3+#REF!',
        );
        expect(read.C4.v).toBe('B');
    });

    it('follows the provided row selection rather than pagination or all matching results', () => {
        const { file, ra, results } = fixture();
        const rows = rowsOf(
            XLSX.read(buildRAExport(file, ra, results, [results[2]])).Sheets[
                'RA Details'
            ],
        );

        expect(rows).toHaveLength(3);
        expect(rows[2][0]).toBe('003');
        expect(rows[2][2]).toBe('B');

        const firstOnly = XLSX.read(
            buildRAExport(file, ra, results, [results[0]]),
        ).Sheets['RA Details'];

        expect(firstOnly['!ref']).toBe('A1:C3');
        expect(rowsOf(firstOnly)).toHaveLength(3);
    });

    it('adds a missing ITEM header with the neighbouring style and keeps other data', () => {
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(
            workbook,
            XLSX.utils.aoa_to_sheet([
                ['Document Reference', 'Amount'],
                ['1', 12],
            ]),
            'RA',
        );
        const sourceBytes = new Uint8Array(
            XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }),
        );
        const ra = parseRASheet(workbook, 'RA');
        const results = matchRA(
            ra,
            [
                {
                    sheetName: 'Jan',
                    rows: [{ si: '1', code: 'ICE', rowIndex: 1 }],
                },
            ],
            ['Jan'],
        );

        const rows = rowsOf(
            XLSX.read(buildRAExport({ workbook, sourceBytes }, ra, results))
                .Sheets.RA,
        );

        expect(rows).toEqual([
            ['Document Reference', 'Amount', 'ITEM'],
            ['1', 12, 'ICE'],
        ]);
    });
});
