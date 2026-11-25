import { ChevronRight, FileSpreadsheet, FileUp, HandCoins } from 'lucide-react';
import { Fragment, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { downloadBytes } from '@/lib/workbook-file';
import { cn } from '@/lib/utils';
import { formatMoney } from '../../lib/format';
import {
    ewtByMonth,
    liquidationTotals,
    liquidationWorkbook,
    monthLabel,
    periodLabel,
    yearOf,
} from '../../lib/liquidation';
import type { Liquidation } from '../../lib/types';
import { ImportSalesDialog } from '../import/import-sales-dialog';
import { StatCard } from '../stat-card';
import { DsrCheck } from './dsr-check';
import { LiquidationCharts } from './liquidation-charts';
import { LiquidationDetails } from './liquidation-details';
import { StatusBadge } from './status-badge';

type Show = 'all' | 'open' | 'issues';

/** SM's half-month liquidations: what each chain owes, the DSR check and the payments. */
export function LiquidationReport({
    liquidations,
    company,
    today,
}: {
    liquidations: Liquidation[];
    company: string;
    today: string;
}) {
    const years = useMemo(
        () => [...new Set(liquidations.map(yearOf))].sort((a, b) => b - a),
        [liquidations],
    );
    const [year, setYear] = useState(years[0] ?? Number(today.slice(0, 4)));
    const [show, setShow] = useState<Show>('all');
    const [open, setOpen] = useState<number | null>(null);
    const [importOpen, setImportOpen] = useState(false);
    // One dialog for both the empty and the filled page, so it stays open
    // (showing "Done") when the first import fills the page in.
    const importDialog = (
        <ImportSalesDialog
            label="Import CLR or CSR"
            variant="outline"
            open={importOpen}
            onOpenChange={setImportOpen}
        />
    );

    const ofYear = liquidations.filter((l) => yearOf(l) === year);
    const visible = ofYear.filter(
        (l) =>
            show === 'all' ||
            (show === 'open' &&
                (l.status === 'unpaid' || l.status === 'short')) ||
            (show === 'issues' && !l.dsrMatches),
    );
    const totals = liquidationTotals(ofYear);
    const months = ewtByMonth(ofYear);
    const chains = [...new Set(ofYear.map((l) => l.chain))].sort();

    return (
        <div className="grid grid-cols-1 gap-6 p-4 md:p-6">
            <Header company={company}>
                {importDialog}
                {liquidations.length > 0 && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                            downloadBytes(
                                liquidationWorkbook(ofYear, company),
                                `${company} SM liquidations ${year}.xlsx`,
                            )
                        }
                    >
                        <FileSpreadsheet />
                        Excel
                    </Button>
                )}
            </Header>

            {!liquidations.length ? (
                <div className="grid max-w-xl justify-items-start gap-3 rounded-xl border border-dashed p-6">
                    <HandCoins className="size-8 text-muted-foreground" />
                    <h2 className="font-semibold">No liquidations yet</h2>
                    <p className="text-sm text-muted-foreground">
                        In the SM Vendor Portal, export the Consolidated
                        Liquidation Report (CLR_DETAIL) and import it here. Add
                        the Consolidated Sales Report (CSR_DETAIL) to check
                        every item against your DSRs.
                    </p>
                    <Button onClick={() => setImportOpen(true)}>
                        <FileUp /> Import CLR or CSR
                    </Button>
                </div>
            ) : (
                <>
                    <section
                        aria-label="Totals"
                        className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
                    >
                        <StatCard
                            label="Net amount due"
                            value={formatMoney(totals.netDue)}
                            hint={`${ofYear.length} liquidations in ${year}, after 1% EWT`}
                        />
                        <StatCard
                            label="Received"
                            value={formatMoney(totals.paid)}
                            hint="Payments recorded"
                        />
                        <StatCard
                            label="Still to receive"
                            value={formatMoney(totals.outstanding)}
                            hint={`${totals.unpaidCount} not fully paid`}
                            tone={
                                totals.outstanding > 0 ? 'warning' : undefined
                            }
                        />
                        <StatCard
                            label="DSR check"
                            value={
                                totals.dsrIssues
                                    ? `${totals.dsrIssues} with differences`
                                    : totals.dsrMissing
                                      ? `${totals.dsrMissing} not checked yet`
                                      : 'All match'
                            }
                            hint={
                                totals.dsrIssues && totals.dsrMissing
                                    ? `${totals.dsrMissing} more without DSRs yet`
                                    : totals.dsrMissing
                                      ? 'No DSRs imported for those days'
                                      : "SM's figure vs imported DSRs"
                            }
                            tone={
                                totals.dsrIssues
                                    ? 'warning'
                                    : totals.dsrMissing
                                      ? undefined
                                      : 'good'
                            }
                        />
                    </section>

                    <LiquidationCharts liquidations={ofYear} />

                    <section className="grid gap-3">
                        <div className="flex flex-wrap items-center gap-3">
                            <h2 className="mr-auto text-base font-semibold">
                                Liquidations
                            </h2>
                            <ToggleGroup
                                type="single"
                                variant="outline"
                                size="sm"
                                value={show}
                                onValueChange={(value) =>
                                    value && setShow(value as Show)
                                }
                            >
                                <ToggleGroupItem value="all">
                                    All
                                </ToggleGroupItem>
                                <ToggleGroupItem value="open">
                                    Not paid
                                </ToggleGroupItem>
                                <ToggleGroupItem value="issues">
                                    DSR differences
                                </ToggleGroupItem>
                            </ToggleGroup>
                            <Select
                                value={String(year)}
                                onValueChange={(value) =>
                                    setYear(Number(value))
                                }
                            >
                                <SelectTrigger
                                    className="w-28"
                                    aria-label="Year"
                                >
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {years.map((y) => (
                                        <SelectItem key={y} value={String(y)}>
                                            {y}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="rounded-xl border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-8" />
                                        <TableHead>Period</TableHead>
                                        <TableHead>Chain</TableHead>
                                        <TableHead className="text-right">
                                            Sales excl. VAT
                                        </TableHead>
                                        <TableHead className="text-right">
                                            EWT 1%
                                        </TableHead>
                                        <TableHead className="text-right">
                                            Net due
                                        </TableHead>
                                        <TableHead className="text-right">
                                            DSR check
                                        </TableHead>
                                        <TableHead className="text-right">
                                            Received
                                        </TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {visible.map((l) => {
                                        const expanded = open === l.id;

                                        return (
                                            <Fragment key={l.id}>
                                                <TableRow
                                                    className="cursor-pointer"
                                                    onClick={() =>
                                                        setOpen(
                                                            expanded
                                                                ? null
                                                                : l.id,
                                                        )
                                                    }
                                                    aria-expanded={expanded}
                                                >
                                                    <TableCell>
                                                        <ChevronRight
                                                            className={cn(
                                                                'size-4 text-muted-foreground transition-transform',
                                                                expanded &&
                                                                    'rotate-90',
                                                            )}
                                                        />
                                                    </TableCell>
                                                    <TableCell className="font-medium">
                                                        {periodLabel(
                                                            l.periodStart,
                                                            l.periodEnd,
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        {l.chain}
                                                        <span className="text-xs text-muted-foreground">
                                                            {' '}
                                                            · {
                                                                l.stores.length
                                                            }{' '}
                                                            store
                                                            {l.stores.length ===
                                                            1
                                                                ? ''
                                                                : 's'}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="text-right tabular-nums">
                                                        {formatMoney(l.sales)}
                                                    </TableCell>
                                                    <TableCell className="text-right tabular-nums">
                                                        {formatMoney(l.ewt)}
                                                    </TableCell>
                                                    <TableCell className="text-right font-medium tabular-nums">
                                                        {formatMoney(l.netDue)}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <DsrCheck
                                                            difference={
                                                                l.dsrMatches
                                                                    ? 0
                                                                    : l.dsrDifference ||
                                                                      0.01
                                                            }
                                                            dsrSales={
                                                                l.dsrSales
                                                            }
                                                        />
                                                    </TableCell>
                                                    <TableCell className="text-right tabular-nums">
                                                        {l.paid
                                                            ? formatMoney(
                                                                  l.paid,
                                                              )
                                                            : '—'}
                                                    </TableCell>
                                                    <TableCell>
                                                        <StatusBadge
                                                            status={l.status}
                                                        />
                                                    </TableCell>
                                                </TableRow>
                                                {expanded && (
                                                    <TableRow className="hover:bg-transparent">
                                                        <TableCell
                                                            colSpan={9}
                                                            className="bg-muted/40 p-0 whitespace-normal"
                                                        >
                                                            <LiquidationDetails
                                                                liquidation={l}
                                                                today={today}
                                                            />
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </Fragment>
                                        );
                                    })}
                                    {!visible.length && (
                                        <TableRow>
                                            <TableCell
                                                colSpan={9}
                                                className="py-10 text-center text-muted-foreground"
                                            >
                                                Nothing to show for this filter.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </section>

                    <section className="grid gap-3">
                        <div>
                            <h2 className="text-base font-semibold">
                                Withholding tax by month
                            </h2>
                            <p className="text-sm text-muted-foreground">
                                1% EWT SM withheld, by the month each period
                                ends. Use it to check SM&apos;s BIR Form 2307
                                certificates.
                            </p>
                        </div>
                        <div className="rounded-xl border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Month</TableHead>
                                        {chains.map((chain) => (
                                            <TableHead
                                                key={chain}
                                                className="text-right"
                                            >
                                                {chain}
                                            </TableHead>
                                        ))}
                                        <TableHead className="text-right">
                                            Total EWT
                                        </TableHead>
                                        <TableHead className="text-right">
                                            Sales excl. VAT
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {months.map((month) => (
                                        <TableRow key={month.month}>
                                            <TableCell className="font-medium">
                                                {monthLabel(month.month)}
                                            </TableCell>
                                            {chains.map((chain) => (
                                                <TableCell
                                                    key={chain}
                                                    className="text-right tabular-nums"
                                                >
                                                    {month.chains[chain]
                                                        ? formatMoney(
                                                              month.chains[
                                                                  chain
                                                              ].ewt,
                                                          )
                                                        : '—'}
                                                </TableCell>
                                            ))}
                                            <TableCell className="text-right font-medium tabular-nums">
                                                {formatMoney(month.ewt)}
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums">
                                                {formatMoney(month.sales)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </section>
                </>
            )}
        </div>
    );
}

function Header({
    company,
    children,
}: {
    company: string;
    children?: React.ReactNode;
}) {
    return (
        <header className="flex flex-wrap items-end justify-between gap-3">
            <div className="space-y-1">
                <h1 className="text-2xl font-semibold tracking-tight">
                    Liquidation
                </h1>
                <p className="max-w-2xl text-sm text-muted-foreground">
                    What SM owes {company} each half-month, from the
                    Consolidated Liquidation Report, checked against your DSRs
                    and the payments you received.
                </p>
            </div>
            {children && <div className="flex gap-2">{children}</div>}
        </header>
    );
}
