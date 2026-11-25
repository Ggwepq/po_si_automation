import { Form } from '@inertiajs/react';
import { ListTree, Trash2 } from 'lucide-react';
import { useState } from 'react';
import LiquidationController from '@/actions/App/Http/Controllers/Sales/LiquidationController';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { fetchJson } from '../../lib/export-report';
import { formatMoney, formatQty } from '../../lib/format';
import { TOLERANCE } from '../../lib/liquidation';
import type { Liquidation, LiquidationItems } from '../../lib/types';
import { DsrCheck } from './dsr-check';
import { RecordPaymentDialog } from './record-payment-dialog';

const shortDate = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString('en-PH', {
        month: 'short',
        day: 'numeric',
    });

/** Missing DSR days as "Nov 3, Nov 5–9". */
function dayRanges(days: string[]): string {
    const ranges: string[][] = [];

    for (const day of days) {
        const last = ranges.at(-1);
        const previous = last?.at(-1);

        if (
            previous &&
            new Date(`${day}T00:00:00`).getTime() -
                new Date(`${previous}T00:00:00`).getTime() ===
                86_400_000
        ) {
            last?.push(day);
        } else {
            ranges.push([day]);
        }
    }

    return ranges
        .map((r) =>
            r.length === 1
                ? shortDate(r[0])
                : `${shortDate(r[0])}–${Number(r.at(-1)?.slice(8))}`,
        )
        .join(', ');
}

/** A liquidation opened up: each store against the DSRs, items, and the payments received. */
export function LiquidationDetails({
    liquidation,
    today,
}: {
    liquidation: Liquidation;
    today: string;
}) {
    const [items, setItems] = useState<LiquidationItems | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const loadItems = async () => {
        setLoading(true);
        setError('');

        try {
            setItems(
                await fetchJson<LiquidationItems>(
                    LiquidationController.items.url(liquidation.id),
                ),
            );
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="grid gap-5 p-4 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
            <section className="grid content-start gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-medium">
                        Stores: SM&apos;s figure against your DSRs
                    </h3>
                    {!items && (
                        <Button
                            size="sm"
                            variant="ghost"
                            disabled={loading}
                            onClick={() => void loadItems()}
                        >
                            {loading ? <Spinner /> : <ListTree />}
                            Compare items
                        </Button>
                    )}
                </div>
                <div className="rounded-lg border bg-background">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Store</TableHead>
                                <TableHead className="text-right">
                                    SM sales
                                </TableHead>
                                <TableHead className="text-right">
                                    DSR sales
                                </TableHead>
                                <TableHead className="text-right">
                                    Check
                                </TableHead>
                                {liquidation.csrImported && (
                                    <TableHead className="text-right">
                                        CSR
                                    </TableHead>
                                )}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {liquidation.stores.map((store) => (
                                <TableRow key={store.code}>
                                    <TableCell className="whitespace-normal">
                                        <div className="font-medium">
                                            {store.name}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            {store.code}
                                            {store.missingDays.length > 0 &&
                                                Math.abs(store.difference) >=
                                                    TOLERANCE && (
                                                    <span className="text-amber-700 dark:text-amber-400">
                                                        {' '}
                                                        · no DSR on{' '}
                                                        {dayRanges(
                                                            store.missingDays,
                                                        )}
                                                    </span>
                                                )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {formatMoney(store.smSales)}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {formatMoney(store.dsrSales)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <DsrCheck
                                            difference={store.difference}
                                            dsrSales={store.dsrSales}
                                        />
                                    </TableCell>
                                    {liquidation.csrImported && (
                                        <TableCell className="text-right tabular-nums">
                                            {store.csrSales === null
                                                ? '—'
                                                : formatMoney(store.csrSales)}
                                        </TableCell>
                                    )}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                {items && (
                    <ItemComparison
                        items={items}
                        hasCsr={liquidation.csrImported}
                    />
                )}
            </section>

            <section className="grid content-start gap-2">
                <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-medium">Payments received</h3>
                    <RecordPaymentDialog
                        liquidation={liquidation}
                        today={today}
                    />
                </div>
                <div className="grid gap-1 rounded-lg border bg-background p-3 text-sm">
                    <Row
                        label="Amount payable"
                        value={liquidation.amountPayable}
                    />
                    <Row label="Less EWT 1%" value={-liquidation.ewt} />
                    <Row
                        label="Net amount due"
                        value={liquidation.netDue}
                        strong
                    />
                    {liquidation.payments.map((payment) => (
                        <div
                            key={payment.id}
                            className="flex items-center gap-2 text-muted-foreground"
                        >
                            <span className="flex-1 truncate">
                                {shortDate(payment.paidOn)}
                                {payment.reference && ` · ${payment.reference}`}
                            </span>
                            <span className="text-foreground tabular-nums">
                                −{formatMoney(payment.amount)}
                            </span>
                            <Form
                                {...LiquidationController.destroyPayment.form(
                                    payment.id,
                                )}
                                options={{ preserveScroll: true }}
                            >
                                {({ processing }) => (
                                    <Button
                                        type="submit"
                                        size="icon"
                                        variant="ghost"
                                        className="size-6"
                                        disabled={processing}
                                        aria-label={`Remove the payment of ${formatMoney(payment.amount)}`}
                                    >
                                        <Trash2 className="size-3.5" />
                                    </Button>
                                )}
                            </Form>
                        </div>
                    ))}
                    <div className="mt-1 border-t pt-2">
                        <Row
                            label={
                                liquidation.balance < 0
                                    ? 'Received over'
                                    : 'Still to receive'
                            }
                            value={Math.abs(liquidation.balance)}
                            strong
                        />
                    </div>
                </div>
            </section>
        </div>
    );
}

function Row({
    label,
    value,
    strong,
}: {
    label: string;
    value: number;
    strong?: boolean;
}) {
    return (
        <div
            className={cn(
                'flex justify-between gap-2',
                strong ? 'font-medium' : 'text-muted-foreground',
            )}
        >
            <span>{label}</span>
            <span className="text-foreground tabular-nums">
                {formatMoney(value)}
            </span>
        </div>
    );
}

/** Items per store; rows where SM and the DSRs disagree are highlighted. */
function ItemComparison({
    items,
    hasCsr,
}: {
    items: LiquidationItems;
    hasCsr: boolean;
}) {
    return (
        <div className="grid gap-3">
            {!hasCsr && (
                <p className="text-xs text-muted-foreground">
                    Import SM&apos;s Consolidated Sales Report for this period
                    to compare item by item. Below are the DSR totals only.
                </p>
            )}
            {items.stores.map((store) => (
                <div
                    key={store.code}
                    className="rounded-lg border bg-background"
                >
                    <div className="border-b px-3 py-2 text-sm font-medium">
                        {store.name}
                    </div>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Item</TableHead>
                                {hasCsr && (
                                    <TableHead className="text-right">
                                        SM qty
                                    </TableHead>
                                )}
                                <TableHead className="text-right">
                                    DSR qty
                                </TableHead>
                                {hasCsr && (
                                    <TableHead className="text-right">
                                        SM sales
                                    </TableHead>
                                )}
                                <TableHead className="text-right">
                                    DSR sales
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {store.items.map((item) => {
                                const off =
                                    hasCsr &&
                                    Math.abs(
                                        (item.csrSales ?? 0) - item.dsrSales,
                                    ) >= 0.01;

                                return (
                                    <TableRow
                                        key={item.code}
                                        className={cn(
                                            off &&
                                                'bg-amber-50 dark:bg-amber-950/40',
                                        )}
                                    >
                                        <TableCell className="max-w-64 truncate">
                                            {item.description}
                                        </TableCell>
                                        {hasCsr && (
                                            <TableCell className="text-right tabular-nums">
                                                {item.csrQty === null
                                                    ? '—'
                                                    : formatQty(item.csrQty)}
                                            </TableCell>
                                        )}
                                        <TableCell className="text-right tabular-nums">
                                            {formatQty(item.dsrQty)}
                                        </TableCell>
                                        {hasCsr && (
                                            <TableCell className="text-right tabular-nums">
                                                {item.csrSales === null
                                                    ? '—'
                                                    : formatMoney(
                                                          item.csrSales,
                                                      )}
                                            </TableCell>
                                        )}
                                        <TableCell className="text-right tabular-nums">
                                            {formatMoney(item.dsrSales)}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            ))}
        </div>
    );
}
