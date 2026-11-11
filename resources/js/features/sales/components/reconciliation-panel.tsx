import { Link } from '@inertiajs/react';
import {
    AlertTriangle,
    CheckCircle2,
    ChevronDown,
    FileUp,
    Scale,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { importMethod as importRoute } from '@/routes/sales';
import { cn } from '@/lib/utils';
import { formatMoney, formatTrendLabel } from '../lib/format';
import { RECONCILE_LABELS, issueCount } from '../lib/reconciliation';
import type { DsrReconciliation, ReconcileStatus } from '../lib/types';

const money = (value: string | null) =>
    value === null ? '—' : formatMoney(Number(value));

const STATUS_STYLE: Record<ReconcileStatus, string> = {
    match: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
    no_sales: 'bg-slate-400/20 text-slate-700 dark:text-slate-300',
    differs: 'bg-amber-400/25 text-amber-800 dark:text-amber-300',
    not_imported: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
    not_in_summary: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
};

function StatusBadge({ status }: { status: ReconcileStatus }) {
    return (
        <span
            className={cn(
                'inline-block rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap',
                STATUS_STYLE[status],
            )}
        >
            {RECONCILE_LABELS[status]}
        </span>
    );
}

function Totals({ r }: { r: DsrReconciliation }) {
    return (
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
            {(
                [
                    ["SM's DSR Summary", r.summaryTotal],
                    ['Imported DSRs', r.detailTotal],
                    ['Difference', r.difference],
                ] as const
            ).map(([label, value]) => (
                <div key={label} className="rounded-lg bg-muted/50 p-3">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="text-lg font-semibold tabular-nums">
                        {money(value)}
                    </dd>
                </div>
            ))}
        </dl>
    );
}

function IssuesTable({ issues }: { issues: DsrReconciliation['issues'] }) {
    return (
        <div className="rounded-lg border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Store</TableHead>
                        <TableHead className="text-right">SM Summary</TableHead>
                        <TableHead className="text-right">
                            Imported DSR
                        </TableHead>
                        <TableHead className="text-right">Difference</TableHead>
                        <TableHead>Status</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {issues.map((issue) => (
                        <TableRow key={`${issue.date}|${issue.siteCode}`}>
                            <TableCell className="whitespace-nowrap">
                                {formatTrendLabel(issue.date)}
                            </TableCell>
                            <TableCell>
                                {issue.siteName}{' '}
                                <span className="text-muted-foreground">
                                    ({issue.siteCode})
                                </span>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                                {money(issue.summary)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                                {money(issue.detail)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                                {money(issue.difference)}
                            </TableCell>
                            <TableCell>
                                <StatusBadge status={issue.status} />
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}

/**
 * Month-end check: SM's DSR Summary (official daily totals) against the
 * imported DSRs, store by store and day by day.
 */
export function ReconciliationPanel({
    reconciliation: r,
}: {
    reconciliation: DsrReconciliation;
}) {
    if (!r.checked) {
        return (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed p-4 text-sm print:hidden">
                <Scale className="size-5 shrink-0 text-muted-foreground" />
                <p className="min-w-0 flex-1 text-muted-foreground">
                    <span className="font-medium text-foreground">
                        Month-end check:{' '}
                    </span>
                    import SM&apos;s DSR Summary for this period to confirm the
                    imported DSRs match SM&apos;s totals.
                </p>
                <Button asChild size="sm" variant="outline">
                    <Link href={importRoute()}>
                        <FileUp /> Import DSR Summary
                    </Link>
                </Button>
            </div>
        );
    }

    const issues = issueCount(r);

    return (
        <Collapsible
            defaultOpen={!r.balanced}
            className="rounded-xl border bg-card print:hidden"
        >
            <CollapsibleTrigger className="group flex w-full flex-wrap items-center gap-3 p-4 text-left">
                {r.balanced ? (
                    <CheckCircle2 className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                ) : (
                    <AlertTriangle className="size-5 shrink-0 text-amber-600 dark:text-amber-400" />
                )}
                <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">
                        Month-end check against SM&apos;s DSR Summary
                    </span>
                    <span className="block text-sm text-muted-foreground">
                        {r.balanced
                            ? `All ${r.daysChecked} days checked match SM's totals.`
                            : `${issues} store-day${issues === 1 ? '' : 's'} need${issues === 1 ? 's' : ''} attention.`}
                    </span>
                </span>
                <ChevronDown className="size-4 transition-transform group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="grid grid-cols-1 gap-4 border-t p-4">
                <Totals r={r} />
                <div className="flex flex-wrap gap-2">
                    {(Object.keys(r.counts) as ReconcileStatus[])
                        .filter((status) => r.counts[status] > 0)
                        .map((status) => (
                            <span
                                key={status}
                                className={cn(
                                    'rounded-full px-2.5 py-1 text-xs font-medium',
                                    STATUS_STYLE[status],
                                )}
                            >
                                {RECONCILE_LABELS[status]}: {r.counts[status]}
                            </span>
                        ))}
                </div>
                {r.issues.length > 0 && (
                    <>
                        <IssuesTable issues={r.issues} />
                        {r.issues.length < issues && (
                            <p className="text-xs text-muted-foreground">
                                Showing the first {r.issues.length} of {issues}.
                            </p>
                        )}
                    </>
                )}
                <p className="text-xs text-muted-foreground">
                    “DSR not imported”: import that day&apos;s DSR (Export
                    Document). “Differs”: re-export and re-import the DSR, as SM
                    may have revised it. “Not in Summary”: re-export the DSR
                    Summary.
                </p>
            </CollapsibleContent>
        </Collapsible>
    );
}
