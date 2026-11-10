export const PAGE_SIZES = [15, 25, 50, 100] as const;

export type PageSize = (typeof PAGE_SIZES)[number] | 'all';

export type Paginated<T> = {
    visible: T[];
    page: number;
    pages: number;
    /** Effective rows per page ('all' resolves to the row count). */
    size: number;
};

/** Slices rows for one page, clamping the page into range. */
export function paginate<T>(
    rows: T[],
    page: number,
    pageSize: PageSize,
): Paginated<T> {
    const size = pageSize === 'all' ? Math.max(1, rows.length) : pageSize;
    const pages = Math.max(1, Math.ceil(rows.length / size));
    const current = Math.min(Math.max(1, page), pages);

    return {
        visible: rows.slice((current - 1) * size, current * size),
        page: current,
        pages,
        size,
    };
}
