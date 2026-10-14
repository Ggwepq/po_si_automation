import {unzipSync, zipSync, strFromU8, strToU8} from 'fflate';
import {DOMParser, XMLSerializer} from '@xmldom/xmldom';
import * as XLSX from 'xlsx';

const MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const nodes = (parent, name) => Array.from(parent.getElementsByTagNameNS('*', name));
const children = (parent, name) => Array.from(parent.childNodes).filter(n => n.nodeType === 1 && n.localName === name);
const parse = bytes => new DOMParser().parseFromString(strFromU8(bytes), 'application/xml');
const serialize = doc => strToU8(new XMLSerializer().serializeToString(doc));
function targetPath(base, target) {
  const parts = (target.startsWith('/') ? target.slice(1) : `${base.slice(0, base.lastIndexOf('/') + 1)}${target}`).split('/');
  const resolved = [];
  for (const part of parts) {if (part === '..') resolved.pop(); else if (part && part !== '.') resolved.push(part);}
  return resolved.join('/');
}

// Patch the original ZIP parts instead of regenerating Excel's style tables.
export function buildRAExport(raFile, raSheet, results, selectedRows = results) {
  if (!raFile.sourceBytes) throw new Error('Please re-upload RA_DETAIL to export with its original formatting.');
  const files = unzipSync(new Uint8Array(raFile.sourceBytes));
  const workbook = parse(files['xl/workbook.xml']);
  const relationships = parse(files['xl/_rels/workbook.xml.rels']);
  const sheetEntries = nodes(workbook, 'sheet');
  const paths = new Map(sheetEntries.map(entry => {
    const id = entry.getAttributeNS(REL, 'id');
    const relationship = nodes(relationships, 'Relationship').find(r => r.getAttribute('Id') === id);
    return [entry.getAttribute('name'), targetPath('xl/workbook.xml', relationship.getAttribute('Target'))];
  }));
  const path = paths.get(raSheet.sheetName);
  if (!path || !files[path]) throw new Error('The original RA worksheet could not be located.');
  const doc = parse(files[path]);
  const originalDimension = nodes(doc, 'dimension')[0]?.getAttribute('ref');
  const selected = new Set(selectedRows.map(r => r.rowIndex));
  const removed = raSheet.rows.filter(r => !selected.has(r.rowIndex)).map(r => r.rowIndex + 1).sort((a, b) => a - b);
  const removedSet = new Set(removed);
  const before = row => {
    let low = 0, high = removed.length;
    while (low < high) {const mid = (low + high) >>> 1; if (removed[mid] < row) low = mid + 1; else high = mid;}
    return low;
  };
  const rowNumber = row => row - before(row);
  const reference = ref => {
    const match = /^(\$?[A-Z]+)(\$?)(\d+)(?::(\$?[A-Z]+)(\$?)(\d+))?$/i.exec(ref);
    if (!match) return ref;
    const start = Number(match[3]), end = Number(match[6] ?? match[3]);
    if (!match[4]) return removedSet.has(start) ? null : `${match[1]}${match[2]}${rowNumber(start)}`;
    const first = rowNumber(start), last = end - before(end + 1);
    return last < first ? null : `${match[1]}${match[2]}${first}:${match[4]}${match[5]}${last}`;
  };
  const formula = (value, context) => value.split(/("(?:[^"]|"")*")/g).map(part => part.startsWith('"') ? part : part.replace(
    /(?<![A-Za-z0-9_.\]])(?:(('(?:[^']|'')+'|[A-Za-z_][A-Za-z0-9_. ]*)!))?(\$?[A-Z]{1,3}\$?\d+(?::\$?[A-Z]{1,3}\$?\d+)?)(?![A-Za-z0-9_(.])/gi,
    (full, prefix, name, address) => {
      const sheet = name ? (name.startsWith("'") ? name.slice(1, -1).replaceAll("''", "'") : name) : context;
      if (sheet?.toLowerCase() !== raSheet.sheetName.toLowerCase()) return full;
      const updated = reference(address);
      return updated ? `${prefix ?? ''}${updated}` : `${prefix ?? ''}#REF!`;
    },
  )).join('');
  const setTextCell = (row, col, value, fallbackStyle) => {
    const address = `${XLSX.utils.encode_col(col)}${row.getAttribute('r')}`;
    let cell = children(row, 'c').find(c => c.getAttribute('r') === address);
    if (!cell) {
      cell = doc.createElementNS(MAIN, 'c'); cell.setAttribute('r', address);
      if (fallbackStyle !== null && fallbackStyle !== undefined) cell.setAttribute('s', fallbackStyle);
      const next = children(row, 'c').find(c => XLSX.utils.decode_cell(c.getAttribute('r')).c > col);
      row.insertBefore(cell, next ?? null);
    }
    cell.setAttribute('t', 'inlineStr');
    while (cell.firstChild) cell.removeChild(cell.firstChild);
    const inline = doc.createElementNS(MAIN, 'is'), text = doc.createElementNS(MAIN, 't');
    text.setAttribute('xml:space', 'preserve'); text.appendChild(doc.createTextNode(value)); inline.appendChild(text); cell.appendChild(inline);
    row.setAttribute('spans', `1:${Math.max(raSheet.itemColumn + 1, ...children(row, 'c').map(c => XLSX.utils.decode_cell(c.getAttribute('r')).c + 1))}`);
  };
  const data = nodes(doc, 'sheetData')[0];
  const rows = new Map(children(data, 'row').map(row => [Number(row.getAttribute('r')), row]));
  const column = nodes(doc, 'col').find(c => Number(c.getAttribute('min')) <= raSheet.itemColumn + 1 && Number(c.getAttribute('max')) >= raSheet.itemColumn + 1);
  const columnStyle = column?.hasAttribute('style') ? column.getAttribute('style') : null;
  if (!raSheet.hasItem) {
    const row = rows.get(raSheet.headerRow + 1);
    const lastCell = children(row, 'c').at(-1);
    setTextCell(row, raSheet.itemColumn, 'ITEM', lastCell?.hasAttribute('s') ? lastCell.getAttribute('s') : null);
  }
  for (const result of results) {
    if (result.status !== 'Matched' || !selected.has(result.rowIndex)) continue;
    const row = rows.get(result.rowIndex + 1);
    if (!row) throw new Error(`RA row ${result.rowIndex + 1} is missing from the original file.`);
    setTextCell(row, raSheet.itemColumn, result.code, columnStyle);
  }
  const adjustRanges = root => {
    for (const node of nodes(root, '*')) {
      for (const attr of ['ref', 'sqref']) {
        if (!node.hasAttribute(attr)) continue;
        const old = node.getAttribute(attr);
        const updated = old.split(/\s+/).map(reference).filter(Boolean).join(' ');
        if (updated) node.setAttribute(attr, updated);
        else if (node.parentNode) node.parentNode.removeChild(node);
      }
    }
    for (const name of ['mergeCells', 'dataValidations']) for (const node of nodes(root, name)) node.setAttribute('count', children(node, name === 'mergeCells' ? 'mergeCell' : 'dataValidation').length);
  };
  const adjustFormulas = (root, sheetName) => {
    let changed = false;
    for (const cell of nodes(root, 'c')) {
      const f = children(cell, 'f')[0];
      if (!f) continue;
      const shared = f.getAttribute('t') === 'shared';
      const original = shared ? raFile.workbook.Sheets[sheetName]?.[cell.getAttribute('r')]?.f ?? f.textContent : f.textContent;
      const updated = formula(original, sheetName);
      if (shared || updated !== f.textContent) {
        f.textContent = updated;
        if (shared) for (const attr of ['t', 'si', 'ref']) f.removeAttribute(attr);
        for (const cached of children(cell, 'v')) cell.removeChild(cached);
        changed = true;
      }
    }
    for (const name of ['formula', 'formula1', 'formula2', 'calculatedColumnFormula', 'totalsRowFormula']) for (const f of nodes(root, name)) {
      const updated = formula(f.textContent, sheetName);
      if (updated !== f.textContent) {f.textContent = updated; changed = true;}
    }
    return changed;
  };
  if (removed.length) {
    adjustFormulas(doc, raSheet.sheetName);
    for (const [oldNumber, row] of rows) {
      if (removedSet.has(oldNumber)) {data.removeChild(row); continue;}
      row.setAttribute('r', rowNumber(oldNumber));
      for (const cell of children(row, 'c')) cell.setAttribute('r', reference(cell.getAttribute('r')));
    }
    adjustRanges(doc);
    for (const [name, otherPath] of paths) {
      if (otherPath === path || !files[otherPath]) continue;
      const otherDoc = parse(files[otherPath]);
      if (adjustFormulas(otherDoc, name)) files[otherPath] = serialize(otherDoc);
    }
    for (const defined of nodes(workbook, 'definedName')) {
      const context = defined.hasAttribute('localSheetId') ? sheetEntries[Number(defined.getAttribute('localSheetId'))]?.getAttribute('name') : null;
      defined.textContent = formula(defined.textContent, context);
    }
    let calculation = nodes(workbook, 'calcPr')[0];
    if (!calculation) {calculation = workbook.createElementNS(MAIN, 'calcPr'); workbook.documentElement.appendChild(calculation);}
    calculation.setAttribute('fullCalcOnLoad', '1'); calculation.setAttribute('forceFullCalc', '1');
    if (files['xl/calcChain.xml']) {
      delete files['xl/calcChain.xml'];
      for (const rel of nodes(relationships, 'Relationship')) if (rel.getAttribute('Type').endsWith('/calcChain')) rel.parentNode.removeChild(rel);
      const types = parse(files['[Content_Types].xml']);
      for (const entry of nodes(types, 'Override')) if (entry.getAttribute('PartName') === '/xl/calcChain.xml') entry.parentNode.removeChild(entry);
      files['xl/_rels/workbook.xml.rels'] = serialize(relationships);
      files['[Content_Types].xml'] = serialize(types);
    }
    files['xl/workbook.xml'] = serialize(workbook);
    // Excel table and chart ranges must follow the rows kept in the export.
    const relPath = `${path.slice(0, path.lastIndexOf('/') + 1)}_rels/${path.slice(path.lastIndexOf('/') + 1)}.rels`;
    if (files[relPath]) for (const rel of nodes(parse(files[relPath]), 'Relationship')) {
      if (!rel.getAttribute('Type').endsWith('/table')) continue;
      const tablePath = targetPath(path, rel.getAttribute('Target'));
      const table = parse(files[tablePath]); adjustRanges(table); adjustFormulas(table, raSheet.sheetName); files[tablePath] = serialize(table);
    }
    for (const chartPath of Object.keys(files).filter(p => /^xl\/charts\/[^/]+\.xml$/.test(p))) {
      const chart = parse(files[chartPath]); let changed = false;
      for (const f of nodes(chart, 'f')) {const updated = formula(f.textContent, null); if (updated !== f.textContent) {f.textContent = updated; changed = true;}}
      if (changed) files[chartPath] = serialize(chart);
    }
  }
  let dimension = nodes(doc, 'dimension')[0];
  if (dimension) {
    const original = XLSX.utils.decode_range(originalDimension);
    original.e.c = Math.max(original.e.c, raSheet.itemColumn);
    original.e.r = Math.max(raSheet.headerRow, original.e.r - before(original.e.r + 2));
    dimension.setAttribute('ref', XLSX.utils.encode_range(original));
  }
  files[path] = serialize(doc);
  return zipSync(files, {level: 6});
}

export function exportRA(raFile, raSheet, results, selectedRows, label = 'All') {
  const bytes = buildRAExport(raFile, raSheet, results, selectedRows);
  const url = URL.createObjectURL(new Blob([bytes], {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${raFile.fileName.replace(/\.xlsx$/i, '')}_${label.replace(/[^a-z0-9]+/gi, '_')}_ITEM.xlsx`;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
