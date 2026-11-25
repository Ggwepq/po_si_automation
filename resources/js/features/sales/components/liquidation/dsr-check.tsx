import { CheckCircle2, TriangleAlert } from 'lucide-react';
import { formatMoney } from '../../lib/format';
import { TOLERANCE } from '../../lib/liquidation';

/**
 * ✓ when the DSRs add up to SM's figure, "No DSRs yet" when none are
 * imported for those days, else the difference (DSR − SM).
 */
export function DsrCheck({
    difference,
    dsrSales,
}: {
    difference: number;
    dsrSales: number;
}) {
    if (dsrSales === 0 && Math.abs(difference) >= TOLERANCE) {
        return (
            <span
                className="text-sm text-muted-foreground"
                title="Import the DSRs for these days to check SM's figure"
            >
                No DSRs yet
            </span>
        );
    }

    if (Math.abs(difference) < TOLERANCE) {
        return (
            <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="size-4" />
                <span className="sr-only">Matches</span>
            </span>
        );
    }

    return (
        <span
            className="inline-flex items-center gap-1 text-amber-700 tabular-nums dark:text-amber-400"
            title="Imported DSR sales minus SM's figure"
        >
            <TriangleAlert className="size-4" />
            {difference > 0 ? '+' : ''}
            {formatMoney(difference)}
        </span>
    );
}
