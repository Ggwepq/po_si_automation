import * as XLSX from 'xlsx';

const text = value => String(value ?? '').trim();
const header = value => text(value).toLowerCase().replace(/[^a-z0-9]/g, '');
const isSI = value => ['si', 'sino', 'sinumber', 'salesinvoiceno', 'salesinvoicenumber'].includes(header(value));

export function parseRASheet(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error(`Worksheet “${sheetName}” is missing.`);
  const grid = XLSX.utils.sheet_to_json(sheet, {header: 1, range: 0, raw: false, defval: ''});
  const headerRow = grid.slice(0, 30).findIndex(row => row.some(v => header(v) === 'documentreference'));
  if (headerRow < 0) throw new Error(`No Document Reference header found in the first 30 rows of “${sheetName}”.`);
  const headers = grid[headerRow];
  const referenceColumns = headers.flatMap((v, i) => header(v) === 'documentreference' ? [i] : []);
  const itemColumns = headers.flatMap((v, i) => header(v) === 'item' ? [i] : []);
  if (referenceColumns.length > 1 || itemColumns.length > 1) throw new Error(`“${sheetName}” has duplicate Document Reference or ITEM headers.`);
  const referenceColumn = referenceColumns[0];
  // Append ITEM beyond all existing cells, including data without a column header.
  const itemColumn = itemColumns[0] ?? XLSX.utils.decode_range(sheet['!ref']).e.c + 1;
  const rows = grid.slice(headerRow + 1).flatMap((values, index) => values.some(v => text(v)) ? [{
    rowIndex: headerRow + index + 1,
    reference: text(values[referenceColumn]),
    existingItem: text(values[itemColumn]),
    values,
  }] : []);
  if (!rows.length) throw new Error(`“${sheetName}” has no RA detail rows.`);
  return {sheetName, headers, headerRow, referenceColumn, itemColumn, hasItem: itemColumns.length === 1, rows};
}

export function parseICRSheet(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error(`Worksheet “${sheetName}” is missing.`);
  const grid = XLSX.utils.sheet_to_json(sheet, {header: 1, range: 0, raw: false, defval: ''});
  const headerRow = grid.slice(0, 30).findIndex(row => row.some(isSI) && row.some(v => header(v) === 'code'));
  if (headerRow < 0) throw new Error(`No SI No. and CODE headers found in the first 30 rows of “${sheetName}”.`);
  const siColumns = grid[headerRow].flatMap((v, i) => isSI(v) ? [i] : []);
  const codeColumns = grid[headerRow].flatMap((v, i) => header(v) === 'code' ? [i] : []);
  if (siColumns.length !== 1 || codeColumns.length !== 1) throw new Error(`“${sheetName}” has duplicate SI No. or CODE headers.`);
  return {sheetName, rows: grid.slice(headerRow + 1).flatMap((values, i) => text(values[siColumns[0]]) ? [{
    si: text(values[siColumns[0]]), code: text(values[codeColumns[0]]), rowIndex: headerRow + i + 1,
  }] : [])};
}

export async function readRAWorkbook(file, kind) {
  if (!/\.xlsx$/i.test(file.name)) throw new Error('Please select an .xlsx workbook.');
  if (file.size > 100 * 1024 * 1024) throw new Error('Please use a workbook smaller than 100 MB.');
  let workbook, bytes;
  try {
    bytes = await file.arrayBuffer();
    // A non-month overview can contain formatting down to Excel's last row.
    // Discover headers using a bounded read before parsing monthly detail.
    workbook = XLSX.read(bytes, {type: 'array', cellStyles: kind === 'ra', ...(kind === 'icr' ? {sheetRows: 30} : {})});
  }
  catch {throw new Error('This workbook could not be read. Select a valid, unprotected .xlsx file.');}
  const parse = kind === 'ra' ? parseRASheet : parseICRSheet;
  let sheets = [];
  const skippedSheets = [];
  for (const name of workbook.SheetNames) {
    try {sheets.push(parse(workbook, name));}
    catch (error) {skippedSheets.push({name, reason: error.message});}
  }
  if (!sheets.length) throw new Error(kind === 'ra' ? 'No sheet with Document Reference data was found.' : 'No sheet with SI No. and CODE headers was found.');
  if (kind === 'icr') {
    const names = sheets.map(s => s.sheetName);
    workbook = XLSX.read(bytes, {type: 'array', sheets: names});
    sheets = names.map(name => parseICRSheet(workbook, name));
  }
  return {fileName: file.name, ...(kind === 'ra' ? {workbook, sourceBytes: new Uint8Array(bytes)} : {}), sheets, skippedSheets, rows: sheets.flatMap(s => s.rows)};
}

export function matchRA(raSheet, icrSheets, selectedMonths) {
  const selected = new Set(selectedMonths);
  const lookup = new Map(), fallbackLookup = new Map();
  for (const sheet of icrSheets) {
    const target = selected.has(sheet.sheetName) ? lookup : fallbackLookup;
    for (const row of sheet.rows) {
      if (!row.si) continue;
      if (!target.has(row.si)) target.set(row.si, {codes: new Set(), months: new Set(), missingCode: false});
      const entry = target.get(row.si);
      entry.months.add(sheet.sheetName);
      if (row.code) entry.codes.add(row.code); else entry.missingCode = true;
    }
  }
  return raSheet.rows.map(row => {
    const fallback = !lookup.has(row.reference) && fallbackLookup.has(row.reference);
    const entry = lookup.get(row.reference) ?? fallbackLookup.get(row.reference);
    let status = 'Not matched', code = '', reason = 'SI number not found anywhere in the ICR workbook.';
    if (!row.reference) {status = 'Needs review'; reason = 'Document Reference is blank.';}
    else if (entry) {
      if (entry.codes.size > 1) {status = 'Needs review'; reason = `Conflicting codes: ${[...entry.codes].join(', ')}.`;}
      else if (entry.missingCode || !entry.codes.size) {status = 'Needs review'; reason = 'A matching ICR row has a blank CODE.';}
      else {status = 'Matched'; code = [...entry.codes][0]; reason = fallback ? 'Found outside selected months. ITEM will be filled from ICR CODE.' : 'ITEM will be filled from ICR CODE.';}
    }
    return {...row, status, code, reason, fallback, months: entry ? [...entry.months] : [], outputItem: status === 'Matched' ? code : row.existingItem};
  });
}

export function updatedRAWorkbook(raFile, raSheet, results) {
  const workbook = structuredClone(raFile.workbook);
  const sheet = workbook.Sheets[raSheet.sheetName];
  if (!raSheet.hasItem) XLSX.utils.sheet_add_aoa(sheet, [['ITEM']], {origin: {r: raSheet.headerRow, c: raSheet.itemColumn}});
  for (const row of results) {
    if (row.status !== 'Matched') continue;
    const address = XLSX.utils.encode_cell({r: row.rowIndex, c: raSheet.itemColumn});
    const previous = sheet[address] ?? {};
    const next = {...previous, t: 's', v: row.code};
    for (const field of ['f', 'F', 'w', 'r', 'h']) delete next[field];
    sheet[address] = next;
    const range = XLSX.utils.decode_range(sheet['!ref']);
    range.e.c = Math.max(range.e.c, raSheet.itemColumn);
    range.e.r = Math.max(range.e.r, row.rowIndex);
    sheet['!ref'] = XLSX.utils.encode_range(range);
  }
  return workbook;
}

