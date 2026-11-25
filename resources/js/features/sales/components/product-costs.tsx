import { Form, router } from '@inertiajs/react';
import { History, Search, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import ProductCostController from '@/actions/App/Http/Controllers/Sales/ProductCostController';
import InputError from '@/components/input-error';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import { formatMoney, formatPercent } from '../lib/format';
import { costCoverage, LOW_MARGIN, sortForCosting } from '../lib/product-costs';
import type { ProductCost } from '../lib/types';
import { ImportCostsDialog } from './import-costs-dialog';

type Show = 'all' | 'missing';

/** Every item the company sells, with the cost used for gross profit. */
export function ProductCosts({
    products,
    today,
}: {
    products: ProductCost[];
    today: string;
}) {
    const [query, setQuery] = useState('');
    const [show, setShow] = useState<Show>('all');
    const [from, setFrom] = useState(today);
    const coverage = costCoverage(products);

    const visible = useMemo(() => {
        const needle = query.trim().toLowerCase();

        return sortForCosting(products).filter(
            (p) =>
                (show === 'all' || p.currentCost === null) &&
                (!needle ||
                    `${p.code} ${p.description}`
                        .toLowerCase()
                        .includes(needle)),
        );
    }, [products, query, show]);

    return (
        <div className="grid grid-cols-1 gap-6 p-4 md:p-6">
            <header className="flex flex-wrap items-end justify-between gap-3">
                <div className="max-w-3xl space-y-1">
                    <h1 className="text-2xl font-semibold tracking-tight">
                        Product costs
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Your cost per unit for each item, used to show gross
                        profit in the sales report. Each sale uses the cost in
                        effect on its date, so a new cost leaves earlier months
                        as they were.
                    </p>
                </div>
                <ImportCostsDialog products={products} today={today} />
            </header>

            {products.length > 0 && (
                <section
                    aria-label="Cost coverage"
                    className="grid gap-2 rounded-xl border bg-card p-4"
                >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="font-medium">
                            {coverage.costed} of {coverage.items} items have a
                            cost
                        </p>
                        <p className="text-sm text-muted-foreground">
                            covering{' '}
                            <span className="font-medium text-foreground">
                                {formatPercent(coverage.salesShare)}
                            </span>{' '}
                            of the last 60 days&apos; sales
                        </p>
                    </div>
                    <div
                        className="h-2 overflow-hidden rounded-full bg-muted"
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(coverage.salesShare)}
                        aria-label="Share of sales with a cost"
                    >
                        <div
                            className={cn(
                                'h-full rounded-full',
                                coverage.salesShare >= 99.5
                                    ? 'bg-emerald-500'
                                    : 'bg-primary',
                            )}
                            style={{ width: `${coverage.salesShare}%` }}
                        />
                    </div>
                    {coverage.costed < coverage.items && (
                        <p className="text-xs text-muted-foreground">
                            Items without a cost are listed first, biggest
                            sellers on top. Sales of those items are left out of
                            gross profit.
                        </p>
                    )}
                </section>
            )}

            <div className="flex flex-wrap items-end gap-3">
                <label className="relative w-full sm:w-72">
                    <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        aria-label="Search items"
                        placeholder="Search item or code…"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="pl-8"
                    />
                </label>
                <ToggleGroup
                    type="single"
                    variant="outline"
                    size="sm"
                    value={show}
                    onValueChange={(value) => value && setShow(value as Show)}
                >
                    <ToggleGroupItem value="all">
                        All ({products.length})
                    </ToggleGroupItem>
                    <ToggleGroupItem value="missing">
                        No cost ({coverage.items - coverage.costed})
                    </ToggleGroupItem>
                </ToggleGroup>
                <div className="ml-auto grid gap-1">
                    <Label htmlFor="costs-from" className="text-xs">
                        Costs typed below start on
                    </Label>
                    <Input
                        id="costs-from"
                        type="date"
                        value={from}
                        onChange={(e) => setFrom(e.target.value)}
                        className="h-9 w-40"
                    />
                </div>
            </div>

            <div className="rounded-xl border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Item</TableHead>
                            <TableHead className="text-right">
                                Sales, 60 days
                            </TableHead>
                            <TableHead className="text-right">
                                SM price / unit
                            </TableHead>
                            <TableHead className="w-36 text-right">
                                Cost / unit
                            </TableHead>
                            <TableHead className="text-right">Margin</TableHead>
                            <TableHead className="w-12" />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {visible.map((product) => (
                            <TableRow key={product.code}>
                                <TableCell className="max-w-80 whitespace-normal">
                                    <div className="font-medium">
                                        {product.description}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        {product.code}
                                        {product.uom && ` · ${product.uom}`}
                                    </div>
                                </TableCell>
                                <TableCell className="text-right text-muted-foreground tabular-nums">
                                    {product.recentSales
                                        ? formatMoney(product.recentSales)
                                        : '—'}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {product.smPrice === null
                                        ? '—'
                                        : formatMoney(product.smPrice)}
                                </TableCell>
                                <TableCell className="text-right">
                                    <InlineCost product={product} from={from} />
                                </TableCell>
                                <TableCell
                                    className={cn(
                                        'text-right tabular-nums',
                                        product.margin !== null &&
                                            product.margin < LOW_MARGIN &&
                                            'font-medium text-rose-600 dark:text-rose-400',
                                    )}
                                    title={
                                        product.margin !== null &&
                                        product.margin < LOW_MARGIN
                                            ? `Below ${LOW_MARGIN}% margin`
                                            : undefined
                                    }
                                >
                                    {product.margin === null
                                        ? '—'
                                        : formatPercent(product.margin)}
                                </TableCell>
                                <TableCell className="text-right">
                                    <CostDialog
                                        product={product}
                                        today={today}
                                    />
                                </TableCell>
                            </TableRow>
                        ))}
                        {!visible.length && (
                            <TableRow>
                                <TableCell
                                    colSpan={6}
                                    className="py-10 text-center text-muted-foreground"
                                >
                                    {products.length
                                        ? 'No items match.'
                                        : 'Import a DSR first: its items appear here.'}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}

/** The cost, editable in place: Enter (or leaving the field) saves it from the chosen date. */
function InlineCost({ product, from }: { product: ProductCost; from: string }) {
    const current =
        product.currentCost === null ? '' : String(product.currentCost);
    const [value, setValue] = useState(current);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const save = () => {
        const next = value.trim();

        if (next === current || (next === '' && current === '')) {
            setError('');

            return;
        }

        router.post(
            ProductCostController.store.url(),
            {
                article_code: product.code,
                unit_cost: next,
                effective_from: from,
            },
            {
                preserveScroll: true,
                preserveState: true,
                onStart: () => setSaving(true),
                onFinish: () => setSaving(false),
                onSuccess: () => setError(''),
                onError: (errors) =>
                    setError(
                        errors.unit_cost ??
                            errors.effective_from ??
                            'Not saved.',
                    ),
            },
        );
    };

    return (
        <div className="grid justify-items-end gap-1">
            <div className="relative">
                <Input
                    aria-label={`Cost per unit of ${product.description}`}
                    inputMode="decimal"
                    value={value}
                    placeholder="Set cost"
                    onChange={(e) => setValue(e.target.value)}
                    onBlur={save}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.currentTarget.blur();
                        } else if (e.key === 'Escape') {
                            setValue(current);
                            setError('');
                        }
                    }}
                    aria-invalid={error ? true : undefined}
                    className={cn(
                        'h-8 w-28 text-right tabular-nums',
                        product.currentCost === null &&
                            !value &&
                            'border-dashed',
                    )}
                />
                {saving && (
                    <Spinner className="absolute top-1/2 -left-6 -translate-y-1/2" />
                )}
            </div>
            {error && <span className="text-xs text-destructive">{error}</span>}
            {!error &&
                product.currentCost === null &&
                product.history.some((h) => h.upcoming) && (
                    <Badge variant="secondary">Upcoming</Badge>
                )}
        </div>
    );
}

/** Set a new cost for an item, and see or remove earlier ones. */
function CostDialog({
    product,
    today,
}: {
    product: ProductCost;
    today: string;
}) {
    const [open, setOpen] = useState(false);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button
                    size="icon"
                    variant="ghost"
                    className="size-8"
                    aria-label={`Cost history for ${product.description}`}
                    title="Cost history and dates"
                >
                    <History className="size-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{product.description}</DialogTitle>
                    <DialogDescription>
                        {product.code}
                        {product.smPrice !== null &&
                            ` · SM pays ${formatMoney(product.smPrice)} per unit`}
                    </DialogDescription>
                </DialogHeader>

                <Form
                    {...ProductCostController.store.form()}
                    options={{ preserveScroll: true }}
                    onSuccess={() => setOpen(false)}
                    className="grid gap-4"
                >
                    {({ processing, errors }) => (
                        <>
                            <input
                                type="hidden"
                                name="article_code"
                                value={product.code}
                            />
                            <div className="grid grid-cols-2 gap-3">
                                <div className="grid gap-2">
                                    <Label htmlFor="unit-cost">
                                        Cost per unit (₱)
                                    </Label>
                                    <Input
                                        id="unit-cost"
                                        name="unit_cost"
                                        required
                                        inputMode="decimal"
                                        autoFocus
                                        defaultValue={product.currentCost ?? ''}
                                        placeholder="e.g. 25.96"
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="effective-from">
                                        Effective from
                                    </Label>
                                    <Input
                                        id="effective-from"
                                        name="effective_from"
                                        type="date"
                                        required
                                        defaultValue={today}
                                    />
                                </div>
                            </div>
                            <InputError
                                message={
                                    errors.unit_cost ??
                                    errors.effective_from ??
                                    errors.article_code
                                }
                            />
                            <p className="text-xs text-muted-foreground">
                                Use the first day the cost applied: sales from
                                that date use it until a newer cost starts. A
                                cost on the same date replaces the old one.
                            </p>
                            <DialogFooter>
                                <DialogClose asChild>
                                    <Button type="button" variant="outline">
                                        Cancel
                                    </Button>
                                </DialogClose>
                                <Button type="submit" disabled={processing}>
                                    {processing && <Spinner />}
                                    Save cost
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </Form>

                {product.history.length > 0 && (
                    <div className="grid gap-2 border-t pt-4">
                        <h3 className="text-sm font-medium">Cost history</h3>
                        <ul className="grid gap-1 text-sm">
                            {product.history.map((entry) => (
                                <li
                                    key={entry.id}
                                    className="flex items-center gap-2"
                                >
                                    <span className="w-24 text-muted-foreground tabular-nums">
                                        {entry.effectiveFrom}
                                    </span>
                                    <span className="tabular-nums">
                                        {formatMoney(entry.unitCost)}
                                    </span>
                                    {entry.upcoming && (
                                        <Badge variant="secondary">
                                            Upcoming
                                        </Badge>
                                    )}
                                    <span className="ml-auto truncate text-xs text-muted-foreground">
                                        {entry.setBy}
                                    </span>
                                    <Form
                                        {...ProductCostController.destroy.form(
                                            entry.id,
                                        )}
                                        options={{ preserveScroll: true }}
                                    >
                                        {({ processing }) => (
                                            <Button
                                                type="submit"
                                                size="icon"
                                                variant="ghost"
                                                className="size-7"
                                                disabled={processing}
                                                aria-label={`Remove the cost from ${entry.effectiveFrom}`}
                                            >
                                                <Trash2 className="size-3.5" />
                                            </Button>
                                        )}
                                    </Form>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
