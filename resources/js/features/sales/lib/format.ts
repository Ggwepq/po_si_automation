const peso = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

const quantity = new Intl.NumberFormat('en-PH', { maximumFractionDigits: 3 });

export const formatMoney = (value: number) => peso.format(value);

export const formatQty = (value: number) => quantity.format(value);

export const formatPercent = (value: number) =>
    `${value.toFixed(value >= 10 ? 1 : 2)}%`;

/** Percentage change from the previous period; null when there is nothing to compare. */
export function percentChange(
    current: number,
    previous: number,
): number | null {
    if (previous === 0) {
        return null;
    }

    return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
}

/** "2026-11-10" → "Nov 10"; "2026-11" → "Nov 2026". */
export function formatTrendLabel(date: string): string {
    const [year, month, day] = date.split('-').map(Number);
    const value = new Date(year, month - 1, day || 1);

    return day
        ? value.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
        : value.toLocaleDateString('en-PH', {
              month: 'short',
              year: 'numeric',
          });
}

export type Slice = { name: string; value: number; share: number };

/** The biggest slices, with the rest combined into "Others" so a pie stays readable. */
export function topSlices<T>(
    rows: T[],
    name: (row: T) => string,
    value: (row: T) => number,
    limit = 6,
): Slice[] {
    const total = rows.reduce((sum, row) => sum + value(row), 0);
    const sorted = [...rows].sort((a, b) => value(b) - value(a));
    const share = (v: number) =>
        total > 0 ? Math.round((v / total) * 10000) / 100 : 0;
    const slices = sorted.slice(0, limit).map((row) => ({
        name: name(row),
        value: value(row),
        share: share(value(row)),
    }));
    const rest = sorted.slice(limit).reduce((sum, row) => sum + value(row), 0);

    return rest > 0
        ? [...slices, { name: 'Others', value: rest, share: share(rest) }]
        : slices;
}
