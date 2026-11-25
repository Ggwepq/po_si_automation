import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { formatMoney, formatPercent, formatQty } from '../lib/format';
import type { ItemSales, StoreSales } from '../lib/types';
import { ProfitCells } from './profit-cells';

export function StoresTable({ stores }: { stores: StoreSales[] }) {
    const hasCosts = stores.some((store) => store.grossProfit !== null);

    return (
        <div className="rounded-xl border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Store</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead className="text-right">Qty sold</TableHead>
                        <TableHead className="text-right">Sales</TableHead>
                        {hasCosts && (
                            <>
                                <TableHead className="text-right">
                                    Gross profit
                                </TableHead>
                                <TableHead className="text-right">
                                    Margin
                                </TableHead>
                            </>
                        )}
                        <TableHead className="text-right">Share</TableHead>
                        <TableHead className="text-right">Items</TableHead>
                        <TableHead>Best seller</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {stores.map((store) => (
                        <TableRow key={store.code}>
                            <TableCell>
                                <div className="font-medium">{store.name}</div>
                                <div className="text-xs text-muted-foreground">
                                    {store.code}
                                </div>
                            </TableCell>
                            <TableCell>{store.company}</TableCell>
                            <TableCell className="text-right tabular-nums">
                                {formatQty(store.qty)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                                {formatMoney(store.sales)}
                            </TableCell>
                            {hasCosts && (
                                <ProfitCells
                                    grossProfit={store.grossProfit}
                                    grossMargin={store.grossMargin}
                                />
                            )}
                            <TableCell className="text-right tabular-nums">
                                {formatPercent(store.share)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                                {store.itemCount}
                            </TableCell>
                            <TableCell
                                className="max-w-56 truncate"
                                title={store.topItem ?? ''}
                            >
                                {store.topItem ?? '—'}
                            </TableCell>
                        </TableRow>
                    ))}
                    {!stores.length && (
                        <TableRow>
                            <TableCell
                                colSpan={hasCosts ? 9 : 7}
                                className="py-10 text-center text-muted-foreground"
                            >
                                No store sales in this period.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
}

/** The lowest sellers by sales, to spot weak products. */
export function SlowMovers({
    items,
    limit = 10,
}: {
    items: ItemSales[];
    limit?: number;
}) {
    const slowest = [...items]
        .sort((a, b) => a.sales - b.sales)
        .slice(0, limit);

    return (
        <div className="rounded-xl border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead className="text-right">Qty sold</TableHead>
                        <TableHead className="text-right">Sales</TableHead>
                        <TableHead className="text-right">Stores</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {slowest.map((item) => (
                        <TableRow key={item.code}>
                            <TableCell className="max-w-72 whitespace-normal">
                                <div className="font-medium">
                                    {item.description}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    {item.code}
                                </div>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                                {formatQty(item.qty)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                                {formatMoney(item.sales)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                                {item.storeCount}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
