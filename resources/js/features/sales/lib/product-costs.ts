import type { ProductCost } from './types';

/** Margins below this (in %) are shown in red. */
export const LOW_MARGIN = 15;

/** How much of the business has a cost: items, and share of recent sales. */
export function costCoverage(products: ProductCost[]) {
    const costed = products.filter((p) => p.currentCost !== null);
    const total = products.reduce((sum, p) => sum + p.recentSales, 0);
    const covered = costed.reduce((sum, p) => sum + p.recentSales, 0);

    return {
        items: products.length,
        costed: costed.length,
        salesShare: total > 0 ? Math.round((covered / total) * 1000) / 10 : 0,
    };
}

/** Items without a cost first, then the biggest sellers. */
export function sortForCosting(products: ProductCost[]): ProductCost[] {
    return [...products].sort(
        (a, b) =>
            Number(a.currentCost !== null) - Number(b.currentCost !== null) ||
            b.recentSales - a.recentSales ||
            a.code.localeCompare(b.code, undefined, { numeric: true }),
    );
}
