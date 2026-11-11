import type { DsrReconciliation, ReconcileStatus } from './types';

/** How each status is shown to users, in the panel and the PDF. */
export const RECONCILE_LABELS: Record<ReconcileStatus, string> = {
    match: 'Match',
    no_sales: 'No sales (0.00)',
    differs: 'Differs',
    not_imported: 'DSR not imported',
    not_in_summary: 'Not in Summary',
};

/** Store-days that need attention, e.g. 3. */
export const issueCount = (r: DsrReconciliation) =>
    r.counts.differs + r.counts.not_imported + r.counts.not_in_summary;

/** One plain sentence for the highlights; null when nothing was checked. */
export function reconciliationSentence(
    r: DsrReconciliation,
    money: (value: number) => string,
): string | null {
    if (!r.checked) {
        return null;
    }

    const days = `${r.daysChecked} day${r.daysChecked === 1 ? '' : 's'}`;

    if (r.balanced) {
        return `The imported DSRs match SM's DSR Summary for all ${days} checked (${money(Number(r.summaryTotal))}).`;
    }

    const parts = (
        [
            ['not_imported', 'DSR not imported'],
            ['differs', 'amount differs'],
            ['not_in_summary', 'not in the Summary'],
        ] as const
    )
        .filter(([status]) => r.counts[status] > 0)
        .map(([status, label]) => `${r.counts[status]} ${label}`);
    const count = issueCount(r);

    return `${count} store-day${count === 1 ? '' : 's'} do not match SM's DSR Summary (${parts.join(', ')}). Imported DSRs total ${money(Number(r.detailTotal))} versus SM's ${money(Number(r.summaryTotal))}.`;
}
