import { router } from '@inertiajs/react';
import { FileUp } from 'lucide-react';
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { formatMoney } from '../lib/format';
import { costsToImport, readCostFile } from '../lib/parse-cost-file';
import type { CostTable } from '../lib/parse-cost-file';
import type { ProductCost } from '../lib/types';

const SKIP = 'skip';

/** Reads a cost sheet (e.g. H&F's "cost finished product") and saves its costs from one date. */
export function ImportCostsDialog({
    products,
    today,
}: {
    products: ProductCost[];
    today: string;
}) {
    const [open, setOpen] = useState(false);
    const [tables, setTables] = useState<CostTable[] | null>(null);
    const [chosen, setChosen] = useState<(number | null)[]>([]);
    const [showAll, setShowAll] = useState(false);
    const [from, setFrom] = useState(today);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const known = useMemo(
        () => new Map(products.map((p) => [p.code, p])),
        [products],
    );
    const costs = useMemo(
        () => (tables ? costsToImport(tables, chosen) : []),
        [tables, chosen],
    );
    const unknown = costs.filter((c) => !known.has(c.article_code)).length;

    const reset = () => {
        setTables(null);
        setChosen([]);
        setShowAll(false);
        setError(null);
    };

    const read = async (file: File | undefined) => {
        reset();

        if (!file) {
            return;
        }

        setBusy(true);

        try {
            const found = await readCostFile(file);

            if (!found.length) {
                setError(
                    'No table with an "ARTICLE CODE" column was found in this file.',
                );
            }

            setTables(found);
            setChosen(found.map((t) => t.costColumn));
        } catch (e) {
            setError(
                e instanceof Error ? e.message : 'The file could not be read.',
            );
        } finally {
            setBusy(false);
        }
    };

    const save = () => {
        router.post(
            ProductCostController.import.url(),
            {
                effective_from: from,
                costs: costs.map(({ article_code, unit_cost }) => ({
                    article_code,
                    unit_cost,
                })),
            },
            {
                preserveScroll: true,
                onStart: () => setBusy(true),
                onFinish: () => setBusy(false),
                onError: (errors) =>
                    setError(Object.values(errors)[0] ?? 'Not saved.'),
                onSuccess: () => {
                    setOpen(false);
                    reset();
                },
            },
        );
    };

    const visible = (tables ?? [])
        .map((table, index) => ({ table, index }))
        .filter(({ table }) => showAll || table.costColumn !== null);
    const hidden = (tables?.length ?? 0) - visible.length;

    return (
        <Dialog
            open={open}
            onOpenChange={(value) => {
                setOpen(value);

                if (!value) {
                    reset();
                }
            }}
        >
            <DialogTrigger asChild>
                <Button size="sm">
                    <FileUp />
                    Import cost sheet
                </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Import a cost sheet</DialogTitle>
                    <DialogDescription>
                        Any Excel file with an "ARTICLE CODE" column, like the
                        "cost finished product" sheet. Choose the column with
                        your cost per unit; "FG" is picked when there is one.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                        <Label htmlFor="cost-file">Cost sheet</Label>
                        <Input
                            id="cost-file"
                            type="file"
                            accept=".xlsx,.xls,.csv"
                            onChange={(e) => read(e.target.files?.[0])}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="cost-from">Effective from</Label>
                        <Input
                            id="cost-from"
                            type="date"
                            value={from}
                            onChange={(e) => setFrom(e.target.value)}
                        />
                    </div>
                </div>

                {visible.length > 0 && (
                    <div className="grid gap-2">
                        <h3 className="text-sm font-medium">Cost column</h3>
                        {visible.map(({ table, index }) => (
                            <div
                                key={table.label}
                                className="flex flex-wrap items-center gap-3 text-sm"
                            >
                                <span className="min-w-40 flex-1">
                                    {table.label}
                                    <span className="text-muted-foreground">
                                        {' '}
                                        · {table.rows.length} items
                                    </span>
                                </span>
                                <Select
                                    value={String(chosen[index] ?? SKIP)}
                                    onValueChange={(value) =>
                                        setChosen((current) =>
                                            current.map((c, i) =>
                                                i === index
                                                    ? value === SKIP
                                                        ? null
                                                        : Number(value)
                                                    : c,
                                            ),
                                        )
                                    }
                                >
                                    <SelectTrigger
                                        className="w-48"
                                        aria-label={`Cost column for ${table.label}`}
                                    >
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={SKIP}>
                                            Don't import
                                        </SelectItem>
                                        {table.columns.map((column) => (
                                            <SelectItem
                                                key={column.index}
                                                value={String(column.index)}
                                            >
                                                {column.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        ))}
                    </div>
                )}
                {hidden > 0 && (
                    <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="justify-self-start px-0"
                        onClick={() => setShowAll(true)}
                    >
                        Show {hidden} more table{hidden === 1 ? '' : 's'} with
                        no cost column
                    </Button>
                )}

                {costs.length > 0 && (
                    <div className="grid gap-2">
                        <h3 className="text-sm font-medium">
                            {costs.length} cost{costs.length === 1 ? '' : 's'}{' '}
                            to save
                        </h3>
                        <ul className="grid max-h-64 gap-1 overflow-y-auto rounded-md border p-2 text-sm">
                            {costs.map((cost) => {
                                const product = known.get(cost.article_code);

                                return (
                                    <li
                                        key={cost.article_code}
                                        className="flex items-center gap-2"
                                    >
                                        <span className="min-w-0 flex-1 truncate">
                                            {cost.description ||
                                                product?.description}
                                            <span className="text-xs text-muted-foreground">
                                                {' '}
                                                {cost.article_code}
                                            </span>
                                        </span>
                                        {!product && (
                                            <Badge variant="outline">
                                                Not in a DSR yet
                                            </Badge>
                                        )}
                                        {product?.currentCost != null &&
                                            product.currentCost !==
                                                Number(cost.unit_cost) && (
                                                <span className="text-xs text-muted-foreground tabular-nums line-through">
                                                    {formatMoney(
                                                        product.currentCost,
                                                    )}
                                                </span>
                                            )}
                                        <span className="tabular-nums">
                                            {formatMoney(
                                                Number(cost.unit_cost),
                                            )}
                                        </span>
                                    </li>
                                );
                            })}
                        </ul>
                        {unknown > 0 && (
                            <p className="text-xs text-muted-foreground">
                                {unknown} item{unknown === 1 ? ' is' : 's are'}{' '}
                                not in any imported DSR yet and will be skipped.
                            </p>
                        )}
                    </div>
                )}

                <InputError message={error ?? undefined} />

                <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="outline">
                            Cancel
                        </Button>
                    </DialogClose>
                    <Button
                        type="button"
                        disabled={busy || costs.length === unknown || !from}
                        onClick={save}
                    >
                        {busy && <Spinner />}
                        Save {costs.length - unknown} cost
                        {costs.length - unknown === 1 ? '' : 's'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
