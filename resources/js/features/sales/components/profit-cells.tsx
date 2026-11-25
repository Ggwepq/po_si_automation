import { TableCell } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { formatMoney, formatPercent } from '../lib/format';

/** Gross profit and margin cells; a dash when the item had no cost yet. */
export function ProfitCells({
    grossProfit,
    grossMargin,
}: {
    grossProfit: number | null;
    grossMargin: number | null;
}) {
    if (grossProfit === null) {
        return (
            <>
                <TableCell
                    className="text-right text-muted-foreground"
                    title="No cost set for this item"
                >
                    —
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                    —
                </TableCell>
            </>
        );
    }

    return (
        <>
            <TableCell
                className={cn(
                    'text-right tabular-nums',
                    grossProfit < 0 && 'text-rose-600 dark:text-rose-400',
                )}
            >
                {formatMoney(grossProfit)}
            </TableCell>
            <TableCell className="text-right tabular-nums">
                {formatPercent(grossMargin ?? 0)}
            </TableCell>
        </>
    );
}
