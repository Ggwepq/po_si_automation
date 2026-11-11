import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatMoney, formatQty, percentChange } from '../lib/format';
import type { SalesTotals } from '../lib/types';

type Card = {
    label: string;
    value: string;
    change: number | null;
    hint: string;
};

function Change({ value }: { value: number | null }) {
    if (value === null) {
        return (
            <span className="text-xs text-muted-foreground">
                No previous data
            </span>
        );
    }

    const Icon = value > 0 ? ArrowUpRight : value < 0 ? ArrowDownRight : Minus;

    return (
        <span
            className={cn(
                'inline-flex items-center gap-0.5 text-xs font-medium',
                value > 0 && 'text-emerald-600 dark:text-emerald-400',
                value < 0 && 'text-rose-600 dark:text-rose-400',
                value === 0 && 'text-muted-foreground',
            )}
        >
            <Icon className="size-3.5" />
            {value > 0 ? '+' : ''}
            {value}%
        </span>
    );
}

export function SummaryCards({
    summary,
    previousLabel,
}: {
    summary: SalesTotals & { previous: SalesTotals };
    previousLabel: string;
}) {
    const { previous } = summary;
    const cards: Card[] = [
        {
            label: 'Total sales',
            value: formatMoney(summary.totalSales),
            change: percentChange(summary.totalSales, previous.totalSales),
            hint: 'Excl. VAT',
        },
        {
            label: 'Quantity sold',
            value: formatQty(summary.totalQty),
            change: percentChange(summary.totalQty, previous.totalQty),
            hint: 'Units across all items',
        },
        {
            label: 'Items sold',
            value: summary.itemCount.toLocaleString(),
            change: percentChange(summary.itemCount, previous.itemCount),
            hint: 'Different articles',
        },
        {
            label: 'Stores reporting',
            value: summary.storeCount.toLocaleString(),
            change: percentChange(summary.storeCount, previous.storeCount),
            hint: 'With sales in the period',
        },
        {
            label: 'Average daily sales',
            value: formatMoney(summary.averageDailySales),
            change: percentChange(
                summary.averageDailySales,
                previous.averageDailySales,
            ),
            hint: `${summary.salesDays} day${summary.salesDays === 1 ? '' : 's'} with sales`,
        },
    ];

    return (
        <section
            aria-label="Summary"
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5 print:grid-cols-5"
        >
            {cards.map((card) => (
                <div
                    key={card.label}
                    className="break-inside-avoid rounded-xl border bg-card p-4"
                >
                    <div className="text-sm text-muted-foreground">
                        {card.label}
                    </div>
                    <div className="mt-1 text-xl font-semibold tabular-nums">
                        {card.value}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <Change value={card.change} />
                        <span className="text-xs text-muted-foreground">
                            vs {previousLabel}
                        </span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                        {card.hint}
                    </div>
                </div>
            ))}
        </section>
    );
}
