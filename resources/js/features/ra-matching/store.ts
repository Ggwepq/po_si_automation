import { useMemo } from 'react';
import { createStore, useStore } from '@/lib/create-store';
import type { PageSize } from '@/lib/paginate';
import { readInBackground } from './lib/read-in-background';
import { matchRA } from './lib/ra-matching';
import { MatchStatus } from './lib/types';
import type { ICRWorkbook, RAWorkbook, WorkbookKind } from './lib/types';

export const RA_FILTERS = [
    'All',
    MatchStatus.Matched,
    MatchStatus.NotMatched,
    MatchStatus.NeedsReview,
] as const;

export type RAFilter = (typeof RA_FILTERS)[number];

type RAState = {
    files: { ra: RAWorkbook | null; icr: ICRWorkbook | null };
    busy: Record<WorkbookKind, boolean>;
    error: string;
    sheetName: string;
    /** Selected ICR months. Never chosen automatically. */
    months: string[];
    query: string;
    filter: RAFilter;
    page: number;
    pageSize: PageSize;
};

const initialFilters = { query: '', filter: 'All', page: 1 } as const;

export const raStore = createStore<RAState>({
    files: { ra: null, icr: null },
    busy: { ra: false, icr: false },
    error: '',
    sheetName: '',
    months: [],
    pageSize: 15,
    ...initialFilters,
});

/** Upload counters: a slower, superseded upload must not overwrite a newer one. */
const versions: Record<WorkbookKind, number> = { ra: 0, icr: 0 };

export async function uploadRAFile(
    kind: WorkbookKind,
    file: File,
): Promise<void> {
    const version = ++versions[kind];
    raStore.set((s) => ({ busy: { ...s.busy, [kind]: true }, error: '' }));

    try {
        const data = await readInBackground(file, kind);

        if (version !== versions[kind]) {
            return;
        }

        raStore.set((s) => ({
            files: { ...s.files, [kind]: data },
            ...(kind === 'ra'
                ? { sheetName: (data as RAWorkbook).sheets[0].sheetName }
                : { months: [] }),
            ...initialFilters,
        }));
    } catch (error) {
        if (version === versions[kind]) {
            const label = kind === 'ra' ? 'RA_DETAIL' : 'ICR';
            raStore.set({
                error: `${label} upload: ${(error as Error).message}`,
            });
        }
    } finally {
        if (version === versions[kind]) {
            raStore.set((s) => ({ busy: { ...s.busy, [kind]: false } }));
        }
    }
}

export function resetRA(): void {
    versions.ra++;
    versions.icr++;
    raStore.reset();
}

export const selectRASheet = (sheetName: string) =>
    raStore.set({ sheetName, ...initialFilters });

export const toggleMonth = (name: string) =>
    raStore.set((s) => ({
        months: s.months.includes(name)
            ? s.months.filter((m) => m !== name)
            : [...s.months, name],
        ...initialFilters,
    }));

export const toggleAllMonths = () =>
    raStore.set((s) => {
        const all = s.files.icr?.sheets.map((sheet) => sheet.sheetName) ?? [];

        return {
            months: s.months.length === all.length ? [] : all,
            ...initialFilters,
        };
    });

export const setRAFilter = (filter: RAFilter) =>
    raStore.set({ filter, page: 1 });
export const setRAQuery = (query: string) => raStore.set({ query, page: 1 });
export const setRAPage = (page: number) => raStore.set({ page });
export const setRAPageSize = (pageSize: PageSize) =>
    raStore.set({ pageSize, page: 1 });
export const clearRAError = () => raStore.set({ error: '' });

/** Store state plus match results derived from the uploads and selections. */
export function useRAWorkspace() {
    const state = useStore(raStore);
    const { ra, icr } = state.files;
    const raSheet = ra?.sheets.find(
        (sheet) => sheet.sheetName === state.sheetName,
    );
    const ready = Boolean(raSheet && icr && state.months.length);

    const results = useMemo(
        () =>
            ready && raSheet && icr
                ? matchRA(raSheet, icr.sheets, state.months)
                : [],
        [ready, raSheet, icr, state.months],
    );

    const counts = useMemo(() => {
        const count = (status: MatchStatus, fallback?: boolean) =>
            results.filter(
                (r) =>
                    r.status === status &&
                    (fallback === undefined || r.fallback === fallback),
            ).length;

        return {
            matched: count(MatchStatus.Matched),
            fallback: count(MatchStatus.Matched, true),
            unmatched: count(MatchStatus.NotMatched),
            review: count(MatchStatus.NeedsReview),
        };
    }, [results]);

    const filtered = useMemo(() => {
        const needle = state.query.toLowerCase().trim();

        return results.filter(
            (row) =>
                (state.filter === 'All' || row.status === state.filter) &&
                [
                    row.reference,
                    row.code,
                    row.existingItem,
                    row.reason,
                    ...row.months,
                ].some((value) => value.toLowerCase().includes(needle)),
        );
    }, [results, state.query, state.filter]);

    return {
        ...state,
        raSheet,
        ready,
        processing: state.busy.ra || state.busy.icr,
        results,
        counts,
        filtered,
    };
}
