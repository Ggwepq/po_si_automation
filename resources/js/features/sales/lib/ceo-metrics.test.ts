import { describe, expect, it } from 'vitest';
import {
    distributionGaps,
    hasPrevious,
    storeConcentration,
    unitEconomics,
    weekdayWeekendSplit,
} from './ceo-metrics';
import type { ItemSales, StoreSales } from './types';

const store = (name: string, sales: number): StoreSales => ({
    code: name,
    name,
    company: 'SVI',
    sales,
    qty: 1,
    itemCount: 1,
    share: 0,
    topItem: null,
    grossProfit: null,
    grossMargin: null,
    costCoverage: 0,
});

const item = (
    description: string,
    sales: number,
    storeCount: number,
): ItemSales => ({
    code: description,
    description,
    uom: 'PC',
    qty: sales / 10,
    sales,
    share: 0,
    averagePrice: 10,
    grossProfit: null,
    grossMargin: null,
    costCoverage: 0,
    storeCount,
});

describe('CEO metrics', () => {
    it('splits daily sales into weekdays and weekends', () => {
        // 2026-10-02 is a Friday, 10-03 Saturday, 10-04 Sunday.
        const split = weekdayWeekendSplit('day', [
            { date: '2026-10-02', sales: 100, qty: 1 },
            { date: '2026-10-03', sales: 300, qty: 1 },
            { date: '2026-10-04', sales: 100, qty: 1 },
        ]);

        expect(split).toEqual({
            weekday: { sales: 100, days: 1, average: 100 },
            weekend: { sales: 400, days: 2, average: 200 },
        });
        expect(weekdayWeekendSplit('month', [])).toBeNull();
    });

    it('measures how much the top fifth of stores brings in', () => {
        const stores = [
            store('A', 500),
            store('B', 200),
            store('C', 150),
            store('D', 100),
            store('E', 50),
        ];

        expect(storeConcentration(stores)).toEqual({
            topCount: 1,
            storeCount: 5,
            share: 50,
        });
        expect(storeConcentration(stores.slice(0, 2))).toBeNull();
    });

    it('finds best sellers missing from some stores and estimates the upside', () => {
        const gaps = distributionGaps(
            [item('LATTE', 800, 8), item('TEA', 300, 10), item('TARO', 90, 3)],
            10,
        );

        expect(
            gaps.map((g) => [
                g.item.description,
                g.missingStores,
                g.salesPerStore,
                g.potential,
            ]),
        ).toEqual([
            ['LATTE', 2, 100, 200],
            ['TARO', 7, 30, 210],
        ]);
    });

    it('works out price per unit and sales per store', () => {
        const totals = {
            totalSales: 1000,
            totalQty: 50,
            itemCount: 3,
            storeCount: 4,
            salesDays: 2,
            averageDailySales: 500,
            grossProfit: null,
            grossMargin: null,
            costCoverage: 0,
        };

        expect(unitEconomics(totals)).toEqual({
            pricePerUnit: 20,
            salesPerStore: 250,
        });
        expect(hasPrevious({ ...totals, totalSales: 0, totalQty: 0 })).toBe(
            false,
        );
    });
});
