import { describe, expect, it } from 'vitest';
import { paginate } from './paginate';

const rows = Array.from({ length: 40 }, (_, i) => i + 1);

describe('paginate', () => {
    it('returns the requested page', () => {
        const result = paginate(rows, 2, 15);

        expect(result.visible).toEqual(rows.slice(15, 30));
        expect(result).toMatchObject({ page: 2, pages: 3, size: 15 });
    });

    it('clamps the page into range', () => {
        expect(paginate(rows, 99, 25).page).toBe(2);
        expect(paginate(rows, 0, 25).page).toBe(1);
    });

    it('shows every row on one page for "all"', () => {
        expect(paginate(rows, 1, 'all')).toMatchObject({ pages: 1, size: 40 });
        expect(paginate([], 1, 'all')).toMatchObject({ visible: [], pages: 1 });
    });
});
