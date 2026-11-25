import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { STATUS_LABELS } from '../../lib/liquidation';
import type { LiquidationStatus } from '../../lib/types';

const TONES: Record<LiquidationStatus, string> = {
    paid: 'border-emerald-600/30 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
    unpaid: 'border-border text-muted-foreground',
    short: 'border-amber-600/30 bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
    over: 'border-sky-600/30 bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
};

export function StatusBadge({ status }: { status: LiquidationStatus }) {
    return (
        <Badge variant="outline" className={cn('font-medium', TONES[status])}>
            {STATUS_LABELS[status]}
        </Badge>
    );
}
