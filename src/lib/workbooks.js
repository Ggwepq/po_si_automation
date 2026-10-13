import * as XLSX from 'xlsx';
import { isPOHeader } from './matching.js';

export function parseSheet(workbook, sheetName, columnOverride) {
  const grid = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {header: 1, raw: false, defval: ''});
  const headerIndex = grid.slice(0, 30).findIndex(row => row.some(isPOHeader));
  if (headerIndex < 0) throw new Error(`No PO No. column found in “${sheetName}”. Choose another sheet or upload a workbook with a PO No. header in its first 30 rows.`);
  const headers = grid[headerIndex].map((h, i) => String(h).trim() || `Column ${i + 1}`);
  if (new Set(headers).size !== headers.length) throw new Error('This sheet has duplicate column names. Give each column a unique header before uploading.');
  const poColumn = columnOverride ?? headers.find(isPOHeader);
  if (!headers.includes(poColumn)) throw new Error('The selected PO number column is missing.');
  const rows = grid.slice(headerIndex + 1).filter(row => row.some(v => String(v ?? '').trim())).map(row => Object.fromEntries(headers.map((h, i) => [h, row[i] ?? ''])));
  if (!rows.length) throw new Error(`“${sheetName}” has no data rows.`);
  return {sheetName, headers, poColumn, rows};
}

export async function readWorkbook(file) {
  if (!/\.xlsx$/i.test(file.name)) throw new Error('Please select an .xlsx workbook.');
  if (file.size > 25 * 1024 * 1024) throw new Error('Please use a workbook smaller than 25 MB.');
  let workbook;
  try { workbook = XLSX.read(await file.arrayBuffer(), {type: 'array'}); }
  catch { throw new Error('This workbook could not be read. Check that it is a valid, unprotected .xlsx file.'); }
  const sheetName = workbook.SheetNames.find(name => {
    const grid = XLSX.utils.sheet_to_json(workbook.Sheets[name], {header: 1, raw: false});
    return grid.slice(0, 30).some(row => row.some(isPOHeader));
  });
  if (!sheetName) throw new Error('No PO No. column found. Both workbooks must contain a PO No. header.');
  return {fileName: file.name, workbook, ...parseSheet(workbook, sheetName)};
}

export function resultsWorkbook(results, headers) {
  const sheet = XLSX.utils.aoa_to_sheet([
    [...headers, 'Delivery Status', 'Matched GR PO No.', 'Matched Receipt No.'],
    ...results.map(r => [...headers.map(h => r.original[h] ?? ''), r.status, r.grPO, r.receiptNumbers.join(', ')]),
  ]);
  sheet['!autofilter'] = {ref: sheet['!ref']};
  sheet['!cols'] = [...headers.map(h => ({wch: /address|description|remarks/i.test(h) ? 42 : Math.max(18, h.length + 2)})), {wch: 18}, {wch: 23}, {wch: 28}];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'PO Delivery Results');
  return workbook;
}

export function exportResults(results, headers) {
  XLSX.writeFile(resultsWorkbook(results, headers), 'PO_Delivery_Results.xlsx');
}
