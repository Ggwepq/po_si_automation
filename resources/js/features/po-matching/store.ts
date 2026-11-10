import { useMemo } from 'react';
import { createStore, useStore } from '@/lib/create-store';
import type { PageSize } from '@/lib/paginate';
import { compareWorkbooks, summarize } from './lib/matching';
import { DeliveryStatus } from './lib/types';
import type { PoWorkbook } from './lib/types';
import { parseSheet, readWorkbook } from './lib/workbooks';

export type PoKind = 'po' | 'gr';

export const PO_FILTERS = [
    'All',
    DeliveryStatus.Delivered,
    DeliveryStatus.Undelivered,
    DeliveryStatus.NeedsReview,
] as const;

export type PoFilter = (typeof PO_FILTERS)[number];

type PoState = {
    files: Record<PoKind, PoWorkbook | null>;
    busy: Record<PoKind, boolean>;
    error: string;
    view: 'results' | 'invoices';
    query: string;
    filter: PoFilter;
    page: number;
    pageSize: PageSize;
};

const initialFilters = { query: '', filter: 'All', page: 1 } as const;

export const poStore = createStore<PoState>({
    files: { po: null, gr: null },
    busy: { po: false, gr: false },
    error: '',
    view: 'results',
    pageSize: 15,
    ...initialFilters,
});

/** Upload counters: a slower, superseded upload must not overwrite a newer one. */
const versions: Record<PoKind, number> = { po: 0, gr: 0 };

const label = (kind: PoKind) => (kind === 'po' ? 'PO' : 'GR');

export async function uploadPoFile(kind: PoKind, file: File): Promise<void> {
    const version = ++versions[kind];
    poStore.set((s) => ({ busy: { ...s.busy, [kind]: true }, error: '' }));

    try {
        const data = await readWorkbook(file);

        if (version !== versions[kind]) {
            return;
        }

        poStore.set((s) => ({
            files: { ...s.files, [kind]: data },
            view: 'results',
            ...initialFilters,
        }));
    } catch (error) {
        if (version === versions[kind]) {
            poStore.set({
                error: `${label(kind)} upload: ${(error as Error).message}`,
            });
        }
    } finally {
        if (version === versions[kind]) {
            poStore.set((s) => ({ busy: { ...s.busy, [kind]: false } }));
        }
    }
}

/** Re-parses an uploaded workbook with a different sheet or PO column. */
export function changePoColumns(
    kind: PoKind,
    sheetName: string,
    column?: string,
): void {
    const current = poStore.get().files[kind];

    if (!current) {
        return;
    }

    try {
        const parsed = parseSheet(current.workbook, sheetName, column);
        poStore.set((s) => ({
            files: { ...s.files, [kind]: { ...current, ...parsed } },
            error: '',
            ...initialFilters,
        }));
    } catch (error) {
        poStore.set({ error: (error as Error).message });
    }
}

export function resetPo(): void {
    versions.po++;
    versions.gr++;
    poStore.reset();
}

export const setPoFilter = (filter: PoFilter) =>
    poStore.set({ filter, page: 1 });
export const setPoQuery = (query: string) => poStore.set({ query, page: 1 });
export const setPoPage = (page: number) => poStore.set({ page });
export const setPoPageSize = (pageSize: PageSize) =>
    poStore.set({ pageSize, page: 1 });
export const setPoView = (view: PoState['view']) => poStore.set({ view });
export const clearPoError = () => poStore.set({ error: '' });

/** Store state plus results derived from the two uploads. */
export function usePoWorkspace() {
    const state = useStore(poStore);
    const { po, gr } = state.files;

    const results = useMemo(
        () => (po && gr ? compareWorkbooks(po, gr) : []),
        [po, gr],
    );
    const counts = useMemo(
        () => (gr ? summarize(results, gr) : null),
        [results, gr],
    );
    const filtered = useMemo(() => {
        const needle = state.query.toLowerCase().trim();

        return results.filter(
            (row) =>
                (state.filter === 'All' || row.status === state.filter) &&
                [
                    row.poNumber,
                    row.grPO,
                    row.vendorCode,
                    row.vendorName,
                    ...row.receiptNumbers,
                ].some((value) => String(value).toLowerCase().includes(needle)),
        );
    }, [results, state.filter, state.query]);

    return {
        ...state,
        ready: Boolean(po && gr),
        processing: state.busy.po || state.busy.gr,
        results,
        counts,
        filtered,
    };
}
