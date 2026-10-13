import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compareWorkbooks, summarize} from '../src/lib/matching.js';
import {resultsWorkbook, parseSheet} from '../src/lib/workbooks.js';
import * as XLSX from 'xlsx';

const po = {poColumn:'PO No.', headers:['PO No.', 'Vendor Code'], rows:[{'PO No.':' PO001 ', 'Vendor Code':'0015'}, {'PO No.':'PO001', 'Vendor Code':'0015'}, {'PO No.':'PO002'}, {'PO No.':''}]};
const gr = {poColumn:'PO No.', headers:['PO No.', 'Receipt No.'], rows:[{'PO No.':'PO001', 'Receipt No.':'R1'}, {'PO No.':'PO001','Receipt No.':'R2'}, {'PO No.':'PO003', 'Receipt No.':'R3'}, {'PO No.':'', 'Receipt No.':'R4'}]};
test('matches across GR rows, preserves repeated PO items, and never matches blank keys', () => {
  const results = compareWorkbooks(po, gr);
  assert.deepEqual(results.map(r => r.status), ['Delivered','Delivered','Undelivered','Needs review']);
  assert.deepEqual(results[0].receiptNumbers, ['R1','R2']);
  assert.equal(results[2].grPO, '');
  assert.deepEqual(summarize(results, gr), {total:2, delivered:1, undelivered:1, review:1, unmatchedGR:1});
});
test('leading zeros and prefixes are significant', () => {
  const result = compareWorkbooks({poColumn:'p', rows:[{p:'001'},{p:'PO001'},{p:'1'}]}, {poColumn:'p', rows:[{p:'1'}],headers:[]});
  assert.deepEqual(result.map(r=>r.status), ['Undelivered','Undelivered','Delivered']);
});
test('export roundtrip keeps all original rows, leading zeros, and literal formula-like text', () => {
  const results = compareWorkbooks(po,gr);
  results[0].original = {...results[0].original, 'Vendor Code':'=1+1'};
  const bytes = XLSX.write(resultsWorkbook(results,po.headers), {type:'buffer',bookType:'xlsx'});
  const sheet = XLSX.read(bytes).Sheets['PO Delivery Results'];
  const data = XLSX.utils.sheet_to_json(sheet, {header:1});
  assert.equal(data.length,5); assert.equal(data[1][1],'=1+1'); assert.equal(data[2][1],'0015'); assert.equal(sheet.B2.f,undefined);
  assert.equal(data[3][2],'Undelivered'); assert.equal(data[3][3],'');
});
test('detects a PO header after introductory rows and rejects sheets without it', () => {
  const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['Title'],['PO No.','Vendor Code'],['001','0015']]),'Data');
  const parsed=parseSheet(wb,'Data'); assert.equal(parsed.rows[0]['PO No.'],'001');
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['Something'],['123']]),'Other');
  assert.throws(()=>parseSheet(wb,'Other'),/No PO No./);
});
