import { describe, expect, it } from 'vitest';
import { costCoverage, sortForCosting } from './product-costs';
import type { ProductCost } from './types';

const product = (
    code: string,
    cost: number | null,
    recentSales: number,
): ProductCost => ({
    code,
    description: code,
    uom: 'PC',
    currentCost: cost,
    smPrice: 30,
    margin: null,
    recentSales,
    history: [],
});

const products = [
    product('A', 10, 300),
    product('B', null, 50),
    product('C', null, 650),
];

describe('product costs', () => {
    it('measures coverage by items and by recent sales', () => {
        expect(costCoverage(products)).toEqual({
            items: 3,
            costed: 1,
            salesShare: 30,
        });
        expect(costCoverage([]).salesShare).toBe(0);
    });

    it('lists items without a cost first, biggest sellers on top', () => {
        expect(sortForCosting(products).map((p) => p.code)).toEqual([
            'C',
            'B',
            'A',
        ]);
    });
});
