import type { DsrReconciliation } from './types';

/** Made-up month-end check for tests. */
export const reconciliation = (
    overrides: Partial<DsrReconciliation> = {},
): DsrReconciliation => ({
    checked: true,
    balanced: false,
    daysChecked: 31,
    counts: {
        match: 200,
        no_sales: 40,
        differs: 1,
        not_imported: 2,
        not_in_summary: 0,
    },
    summaryTotal: '1000.00',
    detailTotal: '950.00',
    difference: '-50.00',
    issues: [
        {
            date: '2026-10-05',
            siteCode: '0001',
            siteName: 'SVI DEMO NORTH',
            company: 'SVI',
            summary: '50.00',
            detail: null,
            difference: '-50.00',
            status: 'not_imported',
        },
    ],
    stores: [],
    ...overrides,
});
