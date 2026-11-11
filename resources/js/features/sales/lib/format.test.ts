import { describe, expect, it } from 'vitest';
import { formatMoney, formatQty, percentChange, topSlices } from './format';

describe('format', () => {
    it('formats pesos and quantities', () => {
        expect(formatMoney(1146.38)).toMatch(/1,146\.38/);
        expect(formatQty(15)).toBe('15');
        expect(formatQty(2.5)).toBe('2.5');
    });

    it('computes change against the previous period', () => {
        expect(percentChange(150, 100)).toBe(50);
        expect(percentChange(75, 100)).toBe(-25);
        expect(percentChange(10, 0)).toBeNull();
    });

    it('groups small pie slices into Others', () => {
        const rows = [
            { n: 'A', v: 50 },
            { n: 'B', v: 30 },
            { n: 'C', v: 15 },
            { n: 'D', v: 5 },
        ];

        expect(
            topSlices(
                rows,
                (r) => r.n,
                (r) => r.v,
                2,
            ),
        ).toEqual([
            { name: 'A', value: 50, share: 50 },
            { name: 'B', value: 30, share: 30 },
            { name: 'Others', value: 20, share: 20 },
        ]);
        expect(
            topSlices(
                rows,
                (r) => r.n,
                (r) => r.v,
                10,
            ),
        ).toHaveLength(4);
    });
});
