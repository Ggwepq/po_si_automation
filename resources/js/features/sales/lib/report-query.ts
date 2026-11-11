import type { PeriodType } from './types';

/** Everything that defines a report view; mirrors the page URL. */
export type ReportQuery = {
    period: PeriodType;
    /** YYYY-MM-DD: any day inside the period, or the start of a custom range. */
    date: string;
    /** YYYY-MM-DD: end of a custom range. */
    end?: string;
    vendors: string[];
    companies: string[];
    sites: string[];
};

const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar date → "YYYY-MM-DD" (no timezone shifts). */
export const toISO = (date: Date) =>
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** "YYYY-MM-DD" → local midnight. */
export function fromISO(iso: string): Date {
    const [year, month, day] = iso.split('-').map(Number);

    return new Date(year, month - 1, day);
}

export function addDays(iso: string, days: number): string {
    const date = fromISO(iso);
    date.setDate(date.getDate() + days);

    return toISO(date);
}

/** The [start, end] of the period of `type` containing `date` (weeks run Mon–Sun). */
export function rangeOf(
    type: Exclude<PeriodType, 'custom'>,
    iso: string,
): [string, string] {
    const date = fromISO(iso);
    const y = date.getFullYear();
    const m = date.getMonth();

    switch (type) {
        case 'daily':
            return [iso, iso];
        case 'weekly': {
            const monday = addDays(iso, -((date.getDay() + 6) % 7));

            return [monday, addDays(monday, 6)];
        }
        case 'monthly':
            return [toISO(new Date(y, m, 1)), toISO(new Date(y, m + 1, 0))];
        case 'quarterly': {
            const first = m - (m % 3);

            return [
                toISO(new Date(y, first, 1)),
                toISO(new Date(y, first + 3, 0)),
            ];
        }
        case 'yearly':
            return [`${y}-01-01`, `${y}-12-31`];
    }
}

export type Preset = {
    id: string;
    label: string;
    period: PeriodType;
    start: string;
    end: string;
};

const preset = (
    id: string,
    label: string,
    period: Exclude<PeriodType, 'custom'>,
    date: string,
): Preset => {
    const [start, end] = rangeOf(period, date);

    return { id, label, period, start, end };
};

/** Quick choices for the date picker, relative to today and the latest imported sales. */
export function presets(today: string, latestSales: string | null): Preset[] {
    const firstOfMonth = rangeOf('monthly', today)[0];
    const lastYear = `${Number(today.slice(0, 4)) - 1}-06-01`;

    return [
        ...(latestSales
            ? [preset('latest', 'Latest sales day', 'daily', latestSales)]
            : []),
        preset('today', 'Today', 'daily', today),
        preset('yesterday', 'Yesterday', 'daily', addDays(today, -1)),
        {
            id: 'last7',
            label: 'Last 7 days',
            period: 'custom',
            start: addDays(today, -6),
            end: today,
        },
        {
            id: 'last30',
            label: 'Last 30 days',
            period: 'custom',
            start: addDays(today, -29),
            end: today,
        },
        preset('thisWeek', 'This week', 'weekly', today),
        preset('lastWeek', 'Last week', 'weekly', addDays(today, -7)),
        preset('thisMonth', 'This month', 'monthly', today),
        preset('lastMonth', 'Last month', 'monthly', addDays(firstOfMonth, -1)),
        preset('thisQuarter', 'This quarter', 'quarterly', today),
        preset('thisYear', 'This year', 'yearly', today),
        preset('lastYear', 'Last year', 'yearly', lastYear),
    ];
}

/** The URL for a report view; filter lists use `name[]` so Laravel reads arrays. */
export function reportUrl(base: string, query: ReportQuery): string {
    const params = new URLSearchParams({
        period: query.period,
        date: query.date,
    });

    if (query.period === 'custom' && query.end) {
        params.set('end', query.end);
    }

    for (const name of ['vendors', 'companies', 'sites'] as const) {
        query[name].forEach((value) => params.append(`${name}[]`, value));
    }

    return `${base}?${params.toString()}`;
}
