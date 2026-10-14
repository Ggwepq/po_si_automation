import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import {unzipSync, zipSync, strFromU8, strToU8} from 'fflate';
import {DOMParser} from '@xmldom/xmldom';
import {parseRASheet, matchRA} from '../src/lib/raMatching.js';
import {buildRAExport} from '../src/lib/raExport.js';

const xml = bytes => new DOMParser().parseFromString(strFromU8(bytes), 'application/xml');
const elements = (doc, tag) => Array.from(doc.getElementsByTagNameNS('*', tag));
function fixture() {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([['Title'], ['Document Reference', 'Amount', 'ITEM'], ['001', 123.45, 'old'], ['002', 0, 'keep'], ['003', 7, 'old3']]);
  sheet.B3.z = '#,##0.00'; sheet.B5 = {t: 'n', f: 'B3+B4', v: 123.45};
  XLSX.utils.book_append_sheet(workbook, sheet, 'RA Details');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['Untouched'], [1]]), 'Notes');
  const files = unzipSync(new Uint8Array(XLSX.write(workbook, {type: 'array', bookType: 'xlsx'})));
  files['xl/worksheets/sheet1.xml'] = strToU8(strFromU8(files['xl/worksheets/sheet1.xml'])
    .replace('<sheetData>', '<cols><col min="1" max="3" width="28.25" customWidth="1" style="0"/></cols><sheetData>')
    .replace('<row r="3">', '<row r="3" ht="32" customHeight="1">')
    .replace('</worksheet>', '<mergeCells count="1"><mergeCell ref="A1:C1"/></mergeCells><autoFilter ref="A2:C5"/><pageMargins left="0.2" right="0.3" top="0.4" bottom="0.5" header="0.1" footer="0.1"/></worksheet>'));
  // Keep an unrelated part byte-for-byte, including binary assets.
  files['xl/media/image1.png'] = Uint8Array.from([137, 80, 78, 71]);
  const sourceBytes = zipSync(files);
  const ra = parseRASheet(workbook, 'RA Details');
  const results = matchRA(ra, [{sheetName: 'Jan', rows: [{si: '001', code: '=literal & <code>'}, {si: '003', code: 'B'}]}], ['Jan']);
  return {file: {workbook, sourceBytes}, ra, results, files};
}

test('all-row export preserves original styles and every unrelated ZIP part byte-for-byte', () => {
  const {file, ra, results, files} = fixture();
  const bytes = buildRAExport(file, ra, results);
  const out = unzipSync(bytes);
  for (const name of Object.keys(files)) if (name !== 'xl/worksheets/sheet1.xml') assert.deepEqual(out[name], files[name], name);
  const before = xml(files['xl/worksheets/sheet1.xml']), after = xml(out['xl/worksheets/sheet1.xml']);
  for (const tag of ['cols', 'mergeCells', 'pageMargins', 'sheetViews']) assert.equal(elements(after, tag)[0]?.toString(), elements(before, tag)[0]?.toString(), tag);
  assert.equal(elements(after, 'row').find(r => r.getAttribute('r') === '3').getAttribute('ht'), '32');
  const read = XLSX.read(bytes, {cellNF: true});
  assert.equal(read.Sheets['RA Details'].C3.v, '=literal & <code>');
  assert.equal(read.Sheets['RA Details'].C3.f, undefined);
  assert.equal(read.Sheets['RA Details'].C4.v, 'keep');
  assert.equal(read.Sheets['RA Details'].B3.z, '#,##0.00');
  assert.equal(read.Sheets['RA Details'].B5.f, 'B3+B4');
});

test('matched export removes excluded rows, compacts records, retains row styles, and moves ranges and formulas', () => {
  const {file, ra, results, files} = fixture();
  const selected = results.filter(r => r.status === 'Matched');
  const bytes = buildRAExport(file, ra, results, selected);
  const out = unzipSync(bytes), doc = xml(out['xl/worksheets/sheet1.xml']);
  assert.deepEqual(out['xl/styles.xml'], files['xl/styles.xml']);
  assert.deepEqual(out['xl/worksheets/sheet2.xml'], files['xl/worksheets/sheet2.xml']);
  assert.deepEqual(elements(doc, 'row').map(r => r.getAttribute('r')), ['1', '2', '3', '4']);
  assert.equal(elements(doc, 'row')[2].getAttribute('ht'), '32');
  assert.equal(elements(doc, 'dimension')[0].getAttribute('ref'), 'A1:C4');
  assert.equal(elements(doc, 'autoFilter')[0].getAttribute('ref'), 'A2:C4');
  const read = XLSX.read(bytes);
  assert.deepEqual(XLSX.utils.sheet_to_json(read.Sheets['RA Details'], {header: 1}).slice(2).map(r => r[0]), ['001', '003']);
  const formulaCell = elements(doc, 'c').find(c => c.getAttribute('r') === 'B4');
  assert.equal(elements(formulaCell, 'f')[0].textContent, 'B3+#REF!');
  assert.equal(read.Sheets['RA Details'].C4.v, 'B');
});

test('search subset export follows the provided row selection rather than pagination or all matching results', () => {
  const {file, ra, results} = fixture();
  const bytes = buildRAExport(file, ra, results, [results[2]]);
  const rows = XLSX.utils.sheet_to_json(XLSX.read(bytes).Sheets['RA Details'], {header: 1});
  assert.equal(rows.length, 3); assert.equal(rows[2][0], '003'); assert.equal(rows[2][2], 'B');
  const firstOnly = XLSX.read(buildRAExport(file, ra, results, [results[0]])).Sheets['RA Details'];
  assert.equal(firstOnly['!ref'], 'A1:C3');
  assert.equal(XLSX.utils.sheet_to_json(firstOnly, {header: 1}).length, 3);
});

test('missing ITEM is added with the neighbouring header style and other data retained', () => {
  const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['Document Reference', 'Amount'], ['1', 12]]), 'RA');
  const sourceBytes = new Uint8Array(XLSX.write(workbook, {type: 'array', bookType: 'xlsx'}));
  const ra = parseRASheet(workbook, 'RA');
  const results = matchRA(ra, [{sheetName: 'Jan', rows: [{si: '1', code: 'ICE'}]}], ['Jan']);
  const bytes = buildRAExport({workbook, sourceBytes}, ra, results);
  const rows = XLSX.utils.sheet_to_json(XLSX.read(bytes).Sheets.RA, {header: 1});
  assert.deepEqual(rows, [['Document Reference', 'Amount', 'ITEM'], ['1', 12, 'ICE']]);
});
