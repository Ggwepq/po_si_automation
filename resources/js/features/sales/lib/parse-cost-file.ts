import * as XLSX from 'xlsx';

/** A table in a cost workbook: a header row with an article code column and the item rows under it. */
export type CostTable = {
    /** e.g. "PRODUCT, row 3" */
    label: string;
    /** Header columns, except the article code itself. */
    columns: { index: number; label: string }[];
    /** Our guess at the column holding the vendor's cost; null when none looks like one. */
    costColumn: number | null;
    rows: {
        code: string;
        description: string;
        /** Number in each column by index; null when blank or not a number. */
        values: Record<number, number | null>;
    }[];
};

const ARTICLE_HEADER = /^ARTICLE\s*(CODE|#|NO\.?|NUMBER)$/;
const DESCRIPTION_HEADER = /DESCRIPTION/;

/** A cell's text; cells hold strings, numbers, booleans, dates or nothing. */
function cellText(value: unknown): string {
    if (value instanceof Date) {
        return value.toISOString();
    }

    return typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
        ? String(value)
        : '';
}

const clean = (value: unknown) =>
    cellText(value).replace(/\s+/g, ' ').trim().toUpperCase();

/**
 * Picks the column with the vendor's own cost: "FG" (finished goods) or a
 * "COST" column that is not SM's ("SM COST" is what SM pays the vendor).
 */
export function guessCostColumn(columns: CostTable['columns']): number | null {
    const find = (test: (label: string) => boolean) =>
        columns.find((column) => test(clean(column.label)))?.index ?? null;

    return (
        find((label) => label === 'FG' || label === 'FG COST') ??
        find((label) => /^(UNIT )?COST( PER UNIT)?$/.test(label)) ??
        find((label) => /COST/.test(label) && !/^SM\b/.test(label))
    );
}

/** An article code as text: SM codes are digits, sometimes stored as numbers. */
function articleCode(value: unknown): string | null {
    const text =
        typeof value === 'number' ? String(Math.trunc(value)) : clean(value);

    return /^\d{4,20}$/.test(text) ? text : null;
}

function toNumber(value: unknown): number | null {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
    }

    const text = cellText(value).replace(/[₱,\s]/g, '');

    return text !== '' && !Number.isNaN(Number(text)) ? Number(text) : null;
}

/** Finds every table with an article code column, in every sheet. */
export function findCostTables(workbook: XLSX.WorkBook): CostTable[] {
    const tables: CostTable[] = [];

    for (const sheetName of workbook.SheetNames) {
        const rows = XLSX.utils.sheet_to_json<unknown[]>(
            workbook.Sheets[sheetName],
            { header: 1, raw: true, defval: null, blankrows: true },
        );

        for (let r = 0; r < rows.length; r++) {
            const header = rows[r] ?? [];
            const codeAt = header.findIndex((cell) =>
                ARTICLE_HEADER.test(clean(cell)),
            );

            if (codeAt < 0) {
                continue;
            }

            const columns = header
                .map((cell, index) => ({ index, label: clean(cell) }))
                .filter(({ index, label }) => label !== '' && index !== codeAt);
            const descriptionAt =
                columns.find(({ label }) => DESCRIPTION_HEADER.test(label))
                    ?.index ?? -1;
            const items: CostTable['rows'] = [];

            // Item rows run until the first row without an article code.
            for (let i = r + 1; i < rows.length; i++) {
                const row = rows[i] ?? [];
                const code = articleCode(row[codeAt]);

                if (code === null) {
                    break;
                }

                items.push({
                    code,
                    description:
                        descriptionAt >= 0
                            ? cellText(row[descriptionAt]).trim()
                            : '',
                    values: Object.fromEntries(
                        columns.map(({ index }) => [
                            index,
                            toNumber(row[index]),
                        ]),
                    ),
                });
            }

            if (items.length) {
                tables.push({
                    label: `${sheetName}, row ${r + 1}`,
                    columns,
                    costColumn: guessCostColumn(columns),
                    rows: items,
                });
            }
        }
    }

    return tables;
}

/** The costs to save: one per item, from each table's chosen column; positive amounts only. */
export function costsToImport(
    tables: CostTable[],
    chosen: (number | null)[],
): { article_code: string; unit_cost: string; description: string }[] {
    const costs = new Map<
        string,
        { article_code: string; unit_cost: string; description: string }
    >();

    tables.forEach((table, t) => {
        const column = chosen[t];

        if (column === null || column === undefined) {
            return;
        }

        for (const row of table.rows) {
            const cost = row.values[column];

            if (cost !== null && cost !== undefined && cost > 0) {
                costs.set(row.code, {
                    article_code: row.code,
                    // Up to 4 decimals, as the server stores them.
                    unit_cost: String(Math.round(cost * 10000) / 10000),
                    description: row.description,
                });
            }
        }
    });

    return [...costs.values()];
}

export async function readCostFile(file: File): Promise<CostTable[]> {
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
        throw new Error('Please select an Excel file (.xlsx, .xls or .csv).');
    }

    return findCostTables(
        XLSX.read(await file.arrayBuffer(), { type: 'array' }),
    );
}
