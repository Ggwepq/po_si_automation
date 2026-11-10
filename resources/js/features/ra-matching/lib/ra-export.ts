import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import type { Document, Element, Node } from '@xmldom/xmldom';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import * as XLSX from 'xlsx';
import { downloadBytes } from '@/lib/workbook-file';
import { MatchStatus } from './types';
import type { RAResult, RASheet, RAWorkbook } from './types';

/*
 * Format-preserving RA export.
 *
 * Instead of regenerating the workbook (which would lose styles, widths,
 * themes and other parts SheetJS does not round-trip), the original .xlsx ZIP
 * is patched in place:
 *   1. matched ITEM cells are written as inline strings;
 *   2. rows outside the export selection are deleted and later rows shift up;
 *   3. every reference to the RA sheet — formulas, ranges, defined names,
 *      tables and charts — is rewritten to follow the moved rows.
 * All other ZIP parts are copied byte-for-byte.
 */

const MAIN_NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const REL_NS =
    'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

type Files = Record<string, Uint8Array>;

const isElement = (node: Node): node is Element => node.nodeType === 1;

const descendants = (parent: Document | Element, name: string): Element[] =>
    Array.from(parent.getElementsByTagNameNS('*', name));

const childElements = (parent: Element, name: string): Element[] =>
    Array.from(parent.childNodes).filter(
        (node): node is Element => isElement(node) && node.localName === name,
    );

const parseXml = (bytes: Uint8Array): Document =>
    new DOMParser().parseFromString(strFromU8(bytes), 'application/xml');

const serializeXml = (doc: Document): Uint8Array =>
    strToU8(new XMLSerializer().serializeToString(doc));

const columnIndex = (cell: Element): number =>
    XLSX.utils.decode_cell(cell.getAttribute('r') ?? 'A1').c;

/** Resolves a relationship target relative to the part that owns it. */
function resolvePartPath(base: string, target: string): string {
    const joined = target.startsWith('/')
        ? target.slice(1)
        : `${base.slice(0, base.lastIndexOf('/') + 1)}${target}`;
    const resolved: string[] = [];

    for (const part of joined.split('/')) {
        if (part === '..') {
            resolved.pop();
        } else if (part && part !== '.') {
            resolved.push(part);
        }
    }

    return resolved.join('/');
}

function sheetPaths(files: Files, workbook: Document): Map<string, string> {
    const relationships = descendants(
        parseXml(files['xl/_rels/workbook.xml.rels']),
        'Relationship',
    );

    return new Map(
        descendants(workbook, 'sheet').map((entry) => {
            const id = entry.getAttributeNS(REL_NS, 'id');
            const target =
                relationships
                    .find((rel) => rel.getAttribute('Id') === id)
                    ?.getAttribute('Target') ?? '';

            return [
                entry.getAttribute('name') ?? '',
                resolvePartPath('xl/workbook.xml', target),
            ];
        }),
    );
}

/**
 * Maps original 1-based Excel row numbers to their position after the
 * `removed` rows are deleted, and rewrites A1-style references accordingly.
 */
function createRowShifter(removed: number[]) {
    const removedSet = new Set(removed);

    /** Number of removed rows strictly before `row` (binary search). */
    const removedBefore = (row: number): number => {
        let low = 0;
        let high = removed.length;

        while (low < high) {
            const mid = (low + high) >>> 1;

            if (removed[mid] < row) {
                low = mid + 1;
            } else {
                high = mid;
            }
        }

        return low;
    };

    const newRowNumber = (row: number): number => row - removedBefore(row);

    /** Returns the shifted reference, or null when it points only at removed rows. */
    const shiftReference = (ref: string): string | null => {
        const match =
            /^(\$?[A-Z]+)(\$?)(\d+)(?::(\$?[A-Z]+)(\$?)(\d+))?$/i.exec(ref);

        if (!match) {
            return ref;
        }

        const start = Number(match[3]);

        if (!match[4]) {
            return removedSet.has(start)
                ? null
                : `${match[1]}${match[2]}${newRowNumber(start)}`;
        }

        const end = Number(match[6]);
        const first = newRowNumber(start);
        const last = end - removedBefore(end + 1);

        return last < first
            ? null
            : `${match[1]}${match[2]}${first}:${match[4]}${match[5]}${last}`;
    };

    return { removedBefore, newRowNumber, shiftReference, removedSet };
}

export function buildRAExport(
    raFile: Pick<RAWorkbook, 'workbook' | 'sourceBytes'>,
    raSheet: RASheet,
    results: RAResult[],
    selectedRows: RAResult[] = results,
): Uint8Array {
    if (!raFile.sourceBytes) {
        throw new Error(
            'Please re-upload RA_DETAIL to export with its original formatting.',
        );
    }

    const files: Files = unzipSync(new Uint8Array(raFile.sourceBytes));
    const workbookDoc = parseXml(files['xl/workbook.xml']);
    const workbookRels = parseXml(files['xl/_rels/workbook.xml.rels']);
    const sheetEntries = descendants(workbookDoc, 'sheet');
    const paths = sheetPaths(files, workbookDoc);
    const path = paths.get(raSheet.sheetName);

    if (!path || !files[path]) {
        throw new Error('The original RA worksheet could not be located.');
    }

    const doc = parseXml(files[path]);
    const originalDimension = descendants(doc, 'dimension')[0]?.getAttribute(
        'ref',
    );
    const selected = new Set(selectedRows.map((row) => row.rowIndex));
    const removed = raSheet.rows
        .filter((row) => !selected.has(row.rowIndex))
        .map((row) => row.rowIndex + 1)
        .sort((a, b) => a - b);
    const { removedBefore, newRowNumber, shiftReference, removedSet } =
        createRowShifter(removed);

    /** Rewrites references to the RA sheet inside a formula; string literals are left alone. */
    const shiftFormula = (value: string, contextSheet: string | null): string =>
        value
            .split(/("(?:[^"]|"")*")/g)
            .map((part) =>
                part.startsWith('"')
                    ? part
                    : part.replace(
                          /(?<![A-Za-z0-9_.\]])(?:(('(?:[^']|'')+'|[A-Za-z_][A-Za-z0-9_. ]*)!))?(\$?[A-Z]{1,3}\$?\d+(?::\$?[A-Z]{1,3}\$?\d+)?)(?![A-Za-z0-9_(.])/gi,
                          (
                              full: string,
                              prefix: string | undefined,
                              name: string | undefined,
                              address: string,
                          ) => {
                              const sheetName = name
                                  ? name.startsWith("'")
                                      ? name.slice(1, -1).replaceAll("''", "'")
                                      : name
                                  : contextSheet;

                              if (
                                  sheetName?.toLowerCase() !==
                                  raSheet.sheetName.toLowerCase()
                              ) {
                                  return full;
                              }

                              const updated = shiftReference(address);

                              return `${prefix ?? ''}${updated ?? '#REF!'}`;
                          },
                      ),
            )
            .join('');

    const setTextCell = (
        row: Element,
        column: number,
        value: string,
        fallbackStyle: string | null,
    ): void => {
        const address = `${XLSX.utils.encode_col(column)}${row.getAttribute('r')}`;
        let cell = childElements(row, 'c').find(
            (candidate) => candidate.getAttribute('r') === address,
        );

        if (!cell) {
            cell = doc.createElementNS(MAIN_NS, 'c');
            cell.setAttribute('r', address);

            if (fallbackStyle !== null) {
                cell.setAttribute('s', fallbackStyle);
            }

            const next = childElements(row, 'c').find(
                (candidate) => columnIndex(candidate) > column,
            );
            row.insertBefore(cell, next ?? null);
        }

        cell.setAttribute('t', 'inlineStr');

        while (cell.firstChild) {
            cell.removeChild(cell.firstChild);
        }

        const inline = doc.createElementNS(MAIN_NS, 'is');
        const textNode = doc.createElementNS(MAIN_NS, 't');
        textNode.setAttribute('xml:space', 'preserve');
        textNode.appendChild(doc.createTextNode(value));
        inline.appendChild(textNode);
        cell.appendChild(inline);

        const lastColumn = Math.max(
            raSheet.itemColumn + 1,
            ...childElements(row, 'c').map((c) => columnIndex(c) + 1),
        );
        row.setAttribute('spans', `1:${lastColumn}`);
    };

    const sheetData = descendants(doc, 'sheetData')[0];
    const rows = new Map(
        childElements(sheetData, 'row').map((row) => [
            Number(row.getAttribute('r')),
            row,
        ]),
    );
    const itemColumnDef = descendants(doc, 'col').find(
        (col) =>
            Number(col.getAttribute('min')) <= raSheet.itemColumn + 1 &&
            Number(col.getAttribute('max')) >= raSheet.itemColumn + 1,
    );
    const columnStyle = itemColumnDef?.getAttribute('style') ?? null;

    // 1. Write ITEM values.
    if (!raSheet.hasItem) {
        const headerRow = rows.get(raSheet.headerRow + 1);

        if (headerRow) {
            const lastCell = childElements(headerRow, 'c').at(-1);
            setTextCell(
                headerRow,
                raSheet.itemColumn,
                'ITEM',
                lastCell?.getAttribute('s') ?? null,
            );
        }
    }

    for (const result of results) {
        if (
            result.status !== MatchStatus.Matched ||
            !selected.has(result.rowIndex)
        ) {
            continue;
        }

        const row = rows.get(result.rowIndex + 1);

        if (!row) {
            throw new Error(
                `RA row ${result.rowIndex + 1} is missing from the original file.`,
            );
        }

        setTextCell(row, raSheet.itemColumn, result.code, columnStyle);
    }

    // 2–3. Remove excluded rows and rewrite every reference that follows them.
    const adjustRanges = (root: Document): void => {
        for (const node of descendants(root, '*')) {
            for (const attribute of ['ref', 'sqref']) {
                const old = node.getAttribute(attribute);

                if (old === null) {
                    continue;
                }

                const updated = old
                    .split(/\s+/)
                    .map(shiftReference)
                    .filter(Boolean)
                    .join(' ');

                if (updated) {
                    node.setAttribute(attribute, updated);
                } else {
                    node.parentNode?.removeChild(node);
                }
            }
        }

        for (const [container, item] of [
            ['mergeCells', 'mergeCell'],
            ['dataValidations', 'dataValidation'],
        ]) {
            for (const node of descendants(root, container)) {
                node.setAttribute(
                    'count',
                    String(childElements(node, item).length),
                );
            }
        }
    };

    const adjustFormulas = (
        root: Document,
        sheetName: string | null,
    ): boolean => {
        let changed = false;

        for (const cell of descendants(root, 'c')) {
            const formula = childElements(cell, 'f')[0];

            if (!formula) {
                continue;
            }

            // Shared formulas are expanded so each cell keeps a correct reference.
            const shared = formula.getAttribute('t') === 'shared';
            const parsedCell = sheetName
                ? (raFile.workbook.Sheets[sheetName]?.[
                      cell.getAttribute('r') ?? ''
                  ] as XLSX.CellObject | undefined)
                : undefined;
            const original = shared
                ? (parsedCell?.f ?? formula.textContent ?? '')
                : (formula.textContent ?? '');
            const updated = shiftFormula(original, sheetName);

            if (shared || updated !== formula.textContent) {
                formula.textContent = updated;

                if (shared) {
                    for (const attribute of ['t', 'si', 'ref']) {
                        formula.removeAttribute(attribute);
                    }
                }

                // Drop cached values; Excel recalculates on open.
                for (const cached of childElements(cell, 'v')) {
                    cell.removeChild(cached);
                }

                changed = true;
            }
        }

        for (const name of [
            'formula',
            'formula1',
            'formula2',
            'calculatedColumnFormula',
            'totalsRowFormula',
        ]) {
            for (const formula of descendants(root, name)) {
                const updated = shiftFormula(
                    formula.textContent ?? '',
                    sheetName,
                );

                if (updated !== formula.textContent) {
                    formula.textContent = updated;
                    changed = true;
                }
            }
        }

        return changed;
    };

    if (removed.length) {
        adjustFormulas(doc, raSheet.sheetName);

        for (const [oldNumber, row] of rows) {
            if (removedSet.has(oldNumber)) {
                sheetData.removeChild(row);
                continue;
            }

            row.setAttribute('r', String(newRowNumber(oldNumber)));

            for (const cell of childElements(row, 'c')) {
                const ref = cell.getAttribute('r');

                if (ref) {
                    cell.setAttribute('r', shiftReference(ref) ?? ref);
                }
            }
        }

        adjustRanges(doc);

        for (const [name, otherPath] of paths) {
            if (otherPath === path || !files[otherPath]) {
                continue;
            }

            const otherDoc = parseXml(files[otherPath]);

            if (adjustFormulas(otherDoc, name)) {
                files[otherPath] = serializeXml(otherDoc);
            }
        }

        for (const defined of descendants(workbookDoc, 'definedName')) {
            const localSheetId = defined.getAttribute('localSheetId');
            const context =
                localSheetId === null
                    ? null
                    : (sheetEntries[Number(localSheetId)]?.getAttribute(
                          'name',
                      ) ?? null);
            defined.textContent = shiftFormula(
                defined.textContent ?? '',
                context,
            );
        }

        let calculation = descendants(workbookDoc, 'calcPr')[0];

        if (!calculation) {
            calculation = workbookDoc.createElementNS(MAIN_NS, 'calcPr');
            workbookDoc.documentElement?.appendChild(calculation);
        }

        calculation.setAttribute('fullCalcOnLoad', '1');
        calculation.setAttribute('forceFullCalc', '1');

        // The calculation chain lists cell addresses that no longer exist.
        if (files['xl/calcChain.xml']) {
            delete files['xl/calcChain.xml'];

            for (const rel of descendants(workbookRels, 'Relationship')) {
                if (rel.getAttribute('Type')?.endsWith('/calcChain')) {
                    rel.parentNode?.removeChild(rel);
                }
            }

            const contentTypes = parseXml(files['[Content_Types].xml']);

            for (const entry of descendants(contentTypes, 'Override')) {
                if (entry.getAttribute('PartName') === '/xl/calcChain.xml') {
                    entry.parentNode?.removeChild(entry);
                }
            }

            files['xl/_rels/workbook.xml.rels'] = serializeXml(workbookRels);
            files['[Content_Types].xml'] = serializeXml(contentTypes);
        }

        files['xl/workbook.xml'] = serializeXml(workbookDoc);

        // Excel table and chart ranges must follow the rows kept in the export.
        const slash = path.lastIndexOf('/');
        const relsPath = `${path.slice(0, slash + 1)}_rels/${path.slice(slash + 1)}.rels`;

        if (files[relsPath]) {
            for (const rel of descendants(
                parseXml(files[relsPath]),
                'Relationship',
            )) {
                if (!rel.getAttribute('Type')?.endsWith('/table')) {
                    continue;
                }

                const tablePath = resolvePartPath(
                    path,
                    rel.getAttribute('Target') ?? '',
                );
                const table = parseXml(files[tablePath]);
                adjustRanges(table);
                adjustFormulas(table, raSheet.sheetName);
                files[tablePath] = serializeXml(table);
            }
        }

        for (const chartPath of Object.keys(files).filter((p) =>
            /^xl\/charts\/[^/]+\.xml$/.test(p),
        )) {
            const chart = parseXml(files[chartPath]);
            let changed = false;

            for (const formula of descendants(chart, 'f')) {
                const updated = shiftFormula(formula.textContent ?? '', null);

                if (updated !== formula.textContent) {
                    formula.textContent = updated;
                    changed = true;
                }
            }

            if (changed) {
                files[chartPath] = serializeXml(chart);
            }
        }
    }

    const dimension = descendants(doc, 'dimension')[0];

    if (dimension && originalDimension) {
        const range = XLSX.utils.decode_range(originalDimension);
        range.e.c = Math.max(range.e.c, raSheet.itemColumn);
        range.e.r = Math.max(
            raSheet.headerRow,
            range.e.r - removedBefore(range.e.r + 2),
        );
        dimension.setAttribute('ref', XLSX.utils.encode_range(range));
    }

    files[path] = serializeXml(doc);

    return zipSync(files, { level: 6 });
}

export function exportRA(
    raFile: RAWorkbook,
    raSheet: RASheet,
    results: RAResult[],
    selectedRows: RAResult[],
    label = 'All',
): void {
    const bytes = buildRAExport(raFile, raSheet, results, selectedRows);
    const baseName = raFile.fileName.replace(/\.xlsx$/i, '');
    const suffix = label.replace(/[^a-z0-9]+/gi, '_');

    downloadBytes(bytes, `${baseName}_${suffix}_ITEM.xlsx`);
}
