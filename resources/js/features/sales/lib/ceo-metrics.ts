import type { ItemSales, SalesTotals, StoreSales, TrendPoint } from './types';

/*
 * Management figures derived from the sales report: how sales split between
 * weekdays and weekends, how concentrated they are in a few stores, and which
 * best sellers are missing from some stores. Pure functions, no guesses
 * beyond what each comment states.
 */

const isWeekend = (iso: string) => {
    const day = new Date(`${iso}T00:00:00Z`).getUTCDay();

    return day === 0 || day === 6;
};

export type DayTypeSales = { sales: number; days: number; average: number };

/** Weekday vs weekend sales; null unless the trend is per day. */
export function weekdayWeekendSplit(
    grouping: 'day' | 'month',
    points: TrendPoint[],
): { weekday: DayTypeSales; weekend: DayTypeSales } | null {
    if (grouping !== 'day' || !points.length) {
        return null;
    }

    const sum = (rows: TrendPoint[]): DayTypeSales => {
        const sales = rows.reduce((total, p) => total + p.sales, 0);

        return {
            sales,
            days: rows.length,
            average: rows.length ? sales / rows.length : 0,
        };
    };

    return {
        weekday: sum(points.filter((p) => !isWeekend(p.date))),
        weekend: sum(points.filter((p) => isWeekend(p.date))),
    };
}

/** Share of sales from the top fifth of stores (at least one store). */
export function storeConcentration(stores: StoreSales[]): {
    topCount: number;
    storeCount: number;
    share: number;
} | null {
    if (stores.length < 3) {
        return null;
    }

    const total = stores.reduce((sum, s) => sum + s.sales, 0);
    const topCount = Math.max(1, Math.round(stores.length / 5));
    const top = [...stores]
        .sort((a, b) => b.sales - a.sales)
        .slice(0, topCount)
        .reduce((sum, s) => sum + s.sales, 0);

    return {
        topCount,
        storeCount: stores.length,
        share: total > 0 ? Math.round((top / total) * 1000) / 10 : 0,
    };
}

export type DistributionGap = {
    item: ItemSales;
    missingStores: number;
    /** Sales per store where the item is sold. */
    salesPerStore: number;
    /**
     * Estimate only: extra sales if the missing stores sold the item at the
     * same average as the stores that carry it.
     */
    potential: number;
};

/** Top sellers that are not sold in every reporting store. */
export function distributionGaps(
    items: ItemSales[],
    reportingStores: number,
    top = 10,
): DistributionGap[] {
    return [...items]
        .sort((a, b) => b.sales - a.sales)
        .slice(0, top)
        .filter(
            (item) => item.storeCount > 0 && item.storeCount < reportingStores,
        )
        .map((item) => {
            const salesPerStore = item.sales / item.storeCount;
            const missingStores = reportingStores - item.storeCount;

            return {
                item,
                missingStores,
                salesPerStore,
                potential: salesPerStore * missingStores,
            };
        });
}

/** Average selling price per unit and sales per reporting store. */
export function unitEconomics(totals: SalesTotals): {
    pricePerUnit: number;
    salesPerStore: number;
} {
    return {
        pricePerUnit:
            totals.totalQty > 0 ? totals.totalSales / totals.totalQty : 0,
        salesPerStore:
            totals.storeCount > 0 ? totals.totalSales / totals.storeCount : 0,
    };
}

/** True when the previous period has any sales to compare with. */
export const hasPrevious = (previous: SalesTotals) =>
    previous.totalSales !== 0 || previous.totalQty !== 0;
