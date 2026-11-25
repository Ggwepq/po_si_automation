import { strToU8, zipSync } from 'fflate';

/*
 * A small writer for styled .xlsx files: fonts, fills, borders, alignment,
 * number formats, merged cells, column widths, row heights, frozen panes and
 * formulas. SheetJS (used everywhere else) cannot write styles in its free
 * edition, and report templates the accountants already use need them.
 */

export type BorderStyle = 'thin' | 'medium' | 'thick';

export type CellStyle = {
    font?: {
        name?: string;
        size?: number;
        bold?: boolean;
        italic?: boolean;
        /** RRGGBB */
        color?: string;
    };
    /** Solid fill colour, RRGGBB. */
    fill?: string;
    border?: Partial<Record<'left' | 'right' | 'top' | 'bottom', BorderStyle>>;
    align?: {
        horizontal?: 'left' | 'center' | 'right';
        vertical?: 'top' | 'center' | 'bottom';
        wrap?: boolean;
    };
    /** Excel number format code, e.g. 'mm-dd-yy'. */
    numFmt?: string;
};

export type Cell = {
    /** Shown value; for a formula, its cached result. */
    value?: string | number | null;
    /** Formula without the leading "=". */
    formula?: string;
    style?: CellStyle;
};

export type SheetSpec = {
    name: string;
    /** cells[row][column], both 0-based. */
    cells: Map<number, Map<number, Cell>>;
    rowHeights?: Map<number, number>;
    /** Column widths in characters, by 0-based column. */
    columnWidths?: Map<number, number>;
    /** Ranges such as "B1:N1". */
    merges?: string[];
    /** Frozen columns to the left (e.g. 2 keeps A:B visible). */
    frozenColumns?: number;
    zoom?: number;
    landscape?: boolean;
};

/** 0 → A, 26 → AA. */
export function columnName(index: number): string {
    let name = '';

    for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
        name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
    }

    return name;
}

export const cellRef = (row: number, column: number) =>
    `${columnName(column)}${row + 1}`;

/** Days since 1899-12-30: how Excel stores a date. */
export function excelDate(iso: string): number {
    const [y, m, d] = iso.split('-').map(Number);

    return (Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86_400_000;
}

const escape = (text: string) =>
    text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

/** Collects distinct fonts, fills, borders and formats into styles.xml. */
class StyleTable {
    private fonts = ['<font><sz val="11"/><name val="Calibri"/></font>'];
    private fills = [
        '<fill><patternFill patternType="none"/></fill>',
        '<fill><patternFill patternType="gray125"/></fill>',
    ];
    private borders = [
        '<border><left/><right/><top/><bottom/><diagonal/></border>',
    ];
    private numFmts: string[] = [];
    private xfs = [
        '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>',
    ];
    private xfIndex = new Map<string, number>();

    id(style: CellStyle | undefined): number {
        if (!style) {
            return 0;
        }

        const key = JSON.stringify(style);
        const known = this.xfIndex.get(key);

        if (known !== undefined) {
            return known;
        }

        const font = this.intern(this.fonts, this.fontXml(style.font));
        const fill = style.fill
            ? this.intern(
                  this.fills,
                  `<fill><patternFill patternType="solid"><fgColor rgb="FF${style.fill}"/><bgColor indexed="64"/></patternFill></fill>`,
              )
            : 0;
        const border = this.intern(this.borders, this.borderXml(style.border));
        const numFmt = style.numFmt ? this.numFmtId(style.numFmt) : 0;
        const align = style.align
            ? `<alignment${style.align.horizontal ? ` horizontal="${style.align.horizontal}"` : ''}${style.align.vertical ? ` vertical="${style.align.vertical}"` : ''}${style.align.wrap ? ' wrapText="1"' : ''}/>`
            : '';

        this.xfs.push(
            `<xf numFmtId="${numFmt}" fontId="${font}" fillId="${fill}" borderId="${border}" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">${align}</xf>`,
        );
        this.xfIndex.set(key, this.xfs.length - 1);

        return this.xfs.length - 1;
    }

    xml(): string {
        const list = (tag: string, items: string[]) =>
            `<${tag} count="${items.length}">${items.join('')}</${tag}>`;
        const formats = this.numFmts.map(
            (code, i) =>
                `<numFmt numFmtId="${164 + i}" formatCode="${escape(code)}"/>`,
        );

        return (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
            (formats.length ? list('numFmts', formats) : '') +
            list('fonts', this.fonts) +
            list('fills', this.fills) +
            list('borders', this.borders) +
            '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
            list('cellXfs', this.xfs) +
            '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
            '</styleSheet>'
        );
    }

    private intern(list: string[], xml: string): number {
        const index = list.indexOf(xml);

        return index >= 0 ? index : list.push(xml) - 1;
    }

    private numFmtId(code: string): number {
        const index = this.numFmts.indexOf(code);

        return 164 + (index >= 0 ? index : this.numFmts.push(code) - 1);
    }

    private fontXml(font: CellStyle['font'] = {}): string {
        return (
            '<font>' +
            (font.bold ? '<b/>' : '') +
            (font.italic ? '<i/>' : '') +
            `<sz val="${font.size ?? 11}"/>` +
            (font.color ? `<color rgb="FF${font.color}"/>` : '') +
            `<name val="${escape(font.name ?? 'Calibri')}"/>` +
            '</font>'
        );
    }

    private borderXml(border: CellStyle['border'] = {}): string {
        const side = (name: 'left' | 'right' | 'top' | 'bottom') =>
            border[name]
                ? `<${name} style="${border[name]}"><color indexed="64"/></${name}>`
                : `<${name}/>`;

        return `<border>${side('left')}${side('right')}${side('top')}${side('bottom')}<diagonal/></border>`;
    }
}

function cellXml(ref: string, cell: Cell, styleId: number): string {
    const s = styleId ? ` s="${styleId}"` : '';
    const { value, formula } = cell;

    if (formula !== undefined) {
        const cached = typeof value === 'number' ? `<v>${value}</v>` : '';

        return `<c r="${ref}"${s}><f>${escape(formula)}</f>${cached}</c>`;
    }

    if (typeof value === 'number') {
        return `<c r="${ref}"${s}><v>${value}</v></c>`;
    }

    if (typeof value === 'string' && value !== '') {
        return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${escape(value)}</t></is></c>`;
    }

    return `<c r="${ref}"${s}/>`;
}

function sheetXml(sheet: SheetSpec, styles: StyleTable): string {
    const rowIndexes = [
        ...new Set([
            ...sheet.cells.keys(),
            ...(sheet.rowHeights?.keys() ?? []),
        ]),
    ].sort((a, b) => a - b);

    const rows = rowIndexes.map((r) => {
        const height = sheet.rowHeights?.get(r);
        const cells = [...(sheet.cells.get(r) ?? new Map<number, Cell>())]
            .sort(([a], [b]) => a - b)
            .map(([c, cell]) =>
                cellXml(cellRef(r, c), cell, styles.id(cell.style)),
            )
            .join('');

        return `<row r="${r + 1}"${height ? ` ht="${height}" customHeight="1"` : ''}>${cells}</row>`;
    });

    const widths = [...(sheet.columnWidths ?? new Map<number, number>())]
        .sort(([a], [b]) => a - b)
        .map(
            ([c, width]) =>
                `<col min="${c + 1}" max="${c + 1}" width="${width}" customWidth="1"/>`,
        );

    const pane = sheet.frozenColumns
        ? `<pane xSplit="${sheet.frozenColumns}" topLeftCell="${columnName(sheet.frozenColumns)}1" activePane="topRight" state="frozen"/>`
        : '';

    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        `<sheetViews><sheetView workbookViewId="0"${sheet.zoom ? ` zoomScale="${sheet.zoom}" zoomScaleNormal="${sheet.zoom}"` : ''}>${pane}</sheetView></sheetViews>` +
        '<sheetFormatPr defaultRowHeight="15"/>' +
        (widths.length ? `<cols>${widths.join('')}</cols>` : '') +
        `<sheetData>${rows.join('')}</sheetData>` +
        (sheet.merges?.length
            ? `<mergeCells count="${sheet.merges.length}">${sheet.merges.map((m) => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>`
            : '') +
        '<pageMargins left="0.25" right="0.25" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>' +
        (sheet.landscape
            ? '<pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/>'
            : '') +
        '</worksheet>'
    );
}

/** Builds the .xlsx file. Excel recalculates formulas when it opens it. */
export function writeXlsx(sheets: SheetSpec[]): Uint8Array {
    const styles = new StyleTable();
    const files: Record<string, Uint8Array> = {};

    sheets.forEach((sheet, i) => {
        files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(
            sheetXml(sheet, styles),
        );
    });

    files['xl/styles.xml'] = strToU8(styles.xml());
    files['[Content_Types].xml'] = strToU8(
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
            '<Default Extension="xml" ContentType="application/xml"/>' +
            '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
            '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
            sheets
                .map(
                    (_, i) =>
                        `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
                )
                .join('') +
            '</Types>',
    );
    files['_rels/.rels'] = strToU8(
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
            '</Relationships>',
    );
    files['xl/workbook.xml'] = strToU8(
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
            `<sheets>${sheets.map((s, i) => `<sheet name="${escape(s.name.slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>` +
            '<calcPr calcId="191029" fullCalcOnLoad="1"/>' +
            '</workbook>',
    );
    files['xl/_rels/workbook.xml.rels'] = strToU8(
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
            sheets
                .map(
                    (_, i) =>
                        `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
                )
                .join('') +
            `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
            '</Relationships>',
    );

    return zipSync(files, { level: 6 });
}
