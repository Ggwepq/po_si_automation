import { Link } from '@inertiajs/react';
import { AlertTriangle, CheckCircle2, ChevronDown, FileUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { importMethod as importRoute } from '@/routes/sales';
import { cn } from '@/lib/utils';
import { formatTrendLabel } from '../lib/format';
import type { DsrCoverage } from '../lib/types';

const dayNumber = (iso: string) => Number(iso.slice(8, 10));

function Legend() {
    return (
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
                <span className="size-3 rounded-sm bg-emerald-500/80" /> DSR
                imported
            </span>
            <span className="flex items-center gap-1.5">
                <span className="size-3 rounded-sm border border-rose-400/70 bg-rose-500/15" />{' '}
                No DSR
            </span>
        </div>
    );
}

function DayGrid({ coverage }: { coverage: DsrCoverage }) {
    return (
        <div className="overflow-x-auto">
            <table className="border-separate border-spacing-0.5 text-xs">
                <thead>
                    <tr>
                        <th className="sticky left-0 bg-card pr-3 text-left font-medium text-muted-foreground">
                            Store
                        </th>
                        {coverage.days.map((day) => (
                            <th
                                key={day}
                                className="w-4 text-center font-normal text-muted-foreground tabular-nums"
                            >
                                {dayNumber(day)}
                            </th>
                        ))}
                        <th className="pl-3 text-right font-medium text-muted-foreground">
                            Days
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {coverage.stores.map((store) => (
                        <tr key={store.code}>
                            <td
                                className="sticky left-0 max-w-48 truncate bg-card pr-3"
                                title={`${store.name} (${store.code})`}
                            >
                                {store.name}
                            </td>
                            {coverage.days.map((day) => {
                                const missing = store.missing.includes(day);

                                return (
                                    <td
                                        key={day}
                                        title={`${store.name} · ${formatTrendLabel(day)}: ${missing ? 'no DSR' : 'imported'}`}
                                    >
                                        <span
                                            className={cn(
                                                'block size-4 rounded-sm',
                                                missing
                                                    ? 'border border-rose-400/70 bg-rose-500/15'
                                                    : 'bg-emerald-500/80',
                                            )}
                                        />
                                    </td>
                                );
                            })}
                            <td className="pl-3 text-right tabular-nums">
                                {store.importedDays}/{coverage.days.length}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function MonthGrid({ coverage }: { coverage: DsrCoverage }) {
    const months = coverage.stores[0]?.months.map((m) => m.month) ?? [];

    return (
        <div className="overflow-x-auto">
            <table className="border-separate border-spacing-1 text-xs">
                <thead>
                    <tr>
                        <th className="sticky left-0 bg-card pr-3 text-left font-medium text-muted-foreground">
                            Store
                        </th>
                        {months.map((month) => (
                            <th
                                key={month}
                                className="min-w-14 text-center font-normal text-muted-foreground"
                            >
                                {formatTrendLabel(month)}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {coverage.stores.map((store) => (
                        <tr key={store.code}>
                            <td className="sticky left-0 max-w-48 truncate bg-card pr-3">
                                {store.name}
                            </td>
                            {store.months.map((m) => (
                                <td
                                    key={m.month}
                                    className={cn(
                                        'rounded-sm px-1.5 py-1 text-center tabular-nums',
                                        m.imported === m.days
                                            ? 'bg-emerald-500/80 text-white'
                                            : m.imported === 0
                                              ? 'border border-rose-400/70 bg-rose-500/15'
                                              : 'bg-amber-400/30',
                                    )}
                                >
                                    {m.imported}/{m.days}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

/**
 * Shows which store-days have an imported DSR in the period, so a missed
 * import is caught before the report is shared.
 */
export function DataCompleteness({ coverage }: { coverage: DsrCoverage }) {
    if (!coverage.stores.length) {
        return null;
    }

    const gaps = coverage.daysWithoutAnyDsr;
    const storeGaps = coverage.stores.filter(
        (s) => s.importedDays < (coverage.daysChecked ?? 0),
    ).length;

    return (
        <Collapsible
            defaultOpen={gaps.length > 0}
            className="rounded-xl border bg-card print:hidden"
        >
            <CollapsibleTrigger className="group flex w-full flex-wrap items-center gap-3 p-4 text-left">
                {coverage.complete ? (
                    <CheckCircle2 className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                ) : (
                    <AlertTriangle
                        className={cn(
                            'size-5 shrink-0',
                            gaps.length
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-amber-600 dark:text-amber-400',
                        )}
                    />
                )}
                <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">
                        Data completeness
                    </span>
                    <span className="block text-sm text-muted-foreground">
                        {coverage.complete
                            ? `Every store has a DSR for all ${coverage.daysChecked} days checked.`
                            : gaps.length
                              ? `${gaps.length} day${gaps.length === 1 ? '' : 's'} with no DSR from any store — probably not imported yet.`
                              : `${storeGaps} store${storeGaps === 1 ? '' : 's'} without a DSR on some days (possibly days without sales).`}
                    </span>
                </span>
                <ChevronDown className="size-4 transition-transform group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="grid grid-cols-1 gap-4 border-t p-4">
                {gaps.length > 0 && (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-rose-500/10 p-3 text-sm">
                        <p>
                            <span className="font-medium">
                                No DSR imported on:{' '}
                            </span>
                            {gaps.slice(0, 12).map(formatTrendLabel).join(', ')}
                            {gaps.length > 12 &&
                                ` and ${gaps.length - 12} more`}
                        </p>
                        <Button asChild size="sm" variant="outline">
                            <Link href={importRoute()}>
                                <FileUp /> Import DSR
                            </Link>
                        </Button>
                    </div>
                )}
                {coverage.mode === 'day' ? (
                    <DayGrid coverage={coverage} />
                ) : (
                    <MonthGrid coverage={coverage} />
                )}
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <Legend />
                    <p className="text-xs text-muted-foreground">
                        Checked up to yesterday; SM posts each day&apos;s DSR
                        the next day. A single store without a DSR may simply
                        have had no sales.
                    </p>
                </div>
            </CollapsibleContent>
        </Collapsible>
    );
}
