import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import {parseRASheet, parseICRSheet, readRAWorkbook, matchRA, updatedRAWorkbook} from '../src/lib/raMatching.js';

function book(sheets) {
  const workbook = XLSX.utils.book_new();
  for (const [name, values] of Object.entries(sheets)) XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(values), name);
  return workbook;
}

test('searches selected months first, falls back elsewhere, deduplicates codes, and preserves exact identifiers', () => {
  const ra = parseRASheet(book({RA: [['Document Reference', 'item'], [' 15305 ', 'ice'], ['001', 'old'], ['1', ''], ['SI-1', ''], ['', 'keep']]}), 'RA');
  const icr = book({August: [['S.I. #', 'CODE'], [15305, 'ICE'], [15305, 'ICE'], ['1', 'ONE']], September: [['CODE', 'SI NO.'], ['ZERO', '001'], ['PREFIX', 'SI-1']]});
  const sheets = icr.SheetNames.map(name => parseICRSheet(icr, name));
  const august = matchRA(ra, sheets, ['August']);
  assert.deepEqual(august.map(r => r.status), ['Matched', 'Matched', 'Matched', 'Matched', 'Needs review']);
  assert.deepEqual(august.map(r => r.outputItem), ['ICE', 'ZERO', 'ONE', 'PREFIX', 'keep']);
  assert.deepEqual(august.map(r => r.fallback), [false, true, false, true, false]);
  assert.deepEqual(august[0].months, ['August']);
  const both = matchRA(ra, sheets, ['August', 'September']);
  assert.equal(both[1].outputItem, 'ZERO'); assert.equal(both[3].outputItem, 'PREFIX');
  assert.equal(both[1].fallback, false);
});

test('selected-month matches take priority; fallback searches all other sheets and exposes conflicts or blanks', () => {
  const ra = parseRASheet(book({RA: [['Document Reference', 'ITEM'], ['1', 'old1'], ['2', 'old2'], ['3', 'old3'], ['4', 'old4']]}), 'RA');
  const icr = book({January: [['SI No.', 'CODE'], ['1', 'PRIORITY']], February: [['SI No.', 'CODE'], ['1', 'OTHER'], ['2', 'A'], ['3', '']], Archive: [['SI No.', 'CODE'], ['2', 'B']]});
  const sheets = icr.SheetNames.map(name => parseICRSheet(icr, name));
  const results = matchRA(ra, sheets, ['January']);
  assert.equal(results[0].code, 'PRIORITY'); assert.equal(results[0].fallback, false);
  assert.deepEqual(results[0].months, ['January']);
  assert.equal(results[1].status, 'Needs review'); assert.equal(results[1].outputItem, 'old2'); assert.equal(results[1].fallback, true);
  assert.deepEqual(results[1].months, ['February', 'Archive']);
  assert.equal(results[2].status, 'Needs review'); assert.equal(results[2].outputItem, 'old3');
  assert.equal(results[3].status, 'Not matched'); assert.equal(results[3].outputItem, 'old4');
  assert.match(results[3].reason, /anywhere in the ICR/);
});

test('conflicts across months and blank codes require review and retain current ITEM', () => {
  const ra = parseRASheet(book({RA: [['Document Reference', 'ITEM'], ['1', 'keep1'], ['2', 'keep2'], ['3', 'keep3']]}), 'RA');
  const icr = book({Jan: [['SI No.', 'CODE'], ['1', 'A'], ['2', 'A'], ['2', ''], ['3', '']], Feb: [['S.I.#', 'Code'], ['1', 'B']]});
  const result = matchRA(ra, icr.SheetNames.map(name => parseICRSheet(icr, name)), ['Jan', 'Feb']);
  assert.ok(result.every(r => r.status === 'Needs review'));
  assert.deepEqual(result.map(r => r.outputItem), ['keep1', 'keep2', 'keep3']);
  assert.match(result[0].reason, /Conflicting codes: A, B/);
  assert.match(result[1].reason, /blank CODE/);
});

test('export changes only matched ITEM cells and retains rows, typed values, formulas, and other sheets', () => {
  const workbook = book({RA: [['Title'], [], ['Document Reference', 'Amount', 'ITEM'], ['001', 125.5, 'old'], [], ['002', 0, 'keep']], Notes: [['Keep this'], [42]]});
  workbook.Sheets.RA.B4.z = '#,##0.00'; workbook.Sheets.RA.B6 = {t: 'n', f: 'B4*2', v: 251};
  const ra = parseRASheet(workbook, 'RA');
  const icr = parseICRSheet(book({Jan: [['SI NO.', 'CODE'], ['001', '=literal']]}), 'Jan');
  const result = matchRA(ra, [icr], ['Jan']);
  const updated = updatedRAWorkbook({workbook}, ra, result);
  assert.equal(workbook.Sheets.RA.C4.v, 'old');
  for (const name of workbook.SheetNames) for (const [address, value] of Object.entries(workbook.Sheets[name])) {
    if (name === 'RA' && address === 'C4') continue;
    assert.deepEqual(updated.Sheets[name][address], value, `${name}!${address}`);
  }
  const bytes = XLSX.write(updated, {type: 'buffer', bookType: 'xlsx'});
  const exported = XLSX.read(bytes, {cellNF: true});
  assert.equal(exported.Sheets.RA.C4.v, '=literal'); assert.equal(exported.Sheets.RA.C4.f, undefined);
  assert.equal(exported.Sheets.RA.C6.v, 'keep'); assert.equal(exported.Sheets.RA.B4.t, 'n');
  assert.equal(exported.Sheets.RA.B4.z, '#,##0.00'); assert.equal(exported.Sheets.RA.B6.f, 'B4*2');
  assert.deepEqual(exported.SheetNames, ['RA', 'Notes']);
});

test('adds ITEM after existing data and uses true Excel row positions for offset tables', () => {
  const workbook = book({RA: [['Document Reference'], ['123', '', 'unlabelled data']]});
  const ra = parseRASheet(workbook, 'RA');
  assert.equal(ra.hasItem, false); assert.equal(ra.itemColumn, 3);
  const result = matchRA(ra, [{sheetName: 'Jan', rows: [{si: '123', code: 'A'}]}], ['Jan']);
  const updated = updatedRAWorkbook({workbook}, ra, result);
  assert.equal(updated.Sheets.RA.D1.v, 'ITEM'); assert.equal(updated.Sheets.RA.D2.v, 'A');
  assert.equal(updated.Sheets.RA.C2.v, 'unlabelled data');
  const offset = XLSX.utils.book_new();
  const sheet = {}; XLSX.utils.sheet_add_aoa(sheet, [['Document Reference', 'ITEM'], ['123', '']], {origin: 'C5'});
  XLSX.utils.book_append_sheet(offset, sheet, 'Offset');
  const parsed = parseRASheet(offset, 'Offset');
  assert.equal(parsed.headerRow, 4); assert.equal(parsed.rows[0].rowIndex, 5); assert.equal(parsed.referenceColumn, 2);
});

test('rejects ambiguous headers, missing headers, and empty RA sheets', () => {
  assert.throws(() => parseRASheet(book({RA: [['Document Reference', 'Document Reference'], ['1', '2']]}), 'RA'), /duplicate/);
  assert.throws(() => parseRASheet(book({RA: [['Document Reference', 'ITEM']]}), 'RA'), /no RA detail rows/);
  assert.throws(() => parseICRSheet(book({Jan: [['SI No.', 'CODE', 'Code'], ['1', 'A', 'B']]}), 'Jan'), /duplicate/);
  assert.throws(() => parseICRSheet(book({Jan: [['SI No.'], ['1']]}), 'Jan'), /No SI No. and CODE/);
});

test('upload discovers compatible sheets, reports excluded sheets, and validates input files', async () => {
  const workbook = book({Overview: [['Title']], August: [['SI NO.', 'CODE'], ['1', 'A']], September: [['CODE', 'S.I. #']]});
  const bytes = XLSX.write(workbook, {type: 'array', bookType: 'xlsx'});
  const parsed = await readRAWorkbook({name: 'ICR.xlsx', size: bytes.byteLength, arrayBuffer: async () => bytes}, 'icr');
  assert.deepEqual(parsed.sheets.map(s => s.sheetName), ['August', 'September']);
  assert.equal(parsed.skippedSheets[0].name, 'Overview');
  await assert.rejects(readRAWorkbook({name: 'file.csv', size: 1}, 'ra'), /xlsx/);
  await assert.rejects(readRAWorkbook({name: 'file.xlsx', size: 101 * 1024 * 1024}, 'ra'), /100 MB/);
});

test('skips an unrelated overview and reads monthly records beyond the header scan', async () => {
  const workbook = book({Overview: [['Title']], January: [['SI No.', 'CODE'], ...Array.from({length: 40}, (_, i) => [`SI${i}`, 'A'])]});
  const bytes = XLSX.write(workbook, {type: 'array', bookType: 'xlsx'});
  const parsed = await readRAWorkbook({name: 'ICR.xlsx', size: bytes.byteLength, arrayBuffer: async () => bytes}, 'icr');
  assert.equal(parsed.skippedSheets[0].name, 'Overview');
  assert.equal(parsed.sheets[0].rows.length, 40);
  assert.equal(parsed.sheets[0].rows.at(-1).si, 'SI39');
});
