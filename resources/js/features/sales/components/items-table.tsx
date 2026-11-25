import { ArrowDownUp, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { TablePagination } from '@/components/workbook/table-pagination';
import { paginate } from '@/lib/paginate';
import type { PageSize } from '@/lib/paginate';
import { cn } from '@/lib/utils';
import { formatMoney, formatPercent, formatQty } from '../lib/format';
import type { ItemSales } from '../lib/types';
import { ProfitCells } from './profit-cells';

type SortKey = 'sales' | 'qty' | 'averagePrice' | 'storeCount' | 'grossProfit';

const SORTS: { key: SortKey; label: string }[] = [
    { key: 'qty', label: 'Qty sold' },
    { key: 'sales', label: 'Sales' },
    { key: 'averagePrice', label: 'Avg price' },
    { key: 'storeCount', label: 'Stores' },
];

const PROFIT_SORT = { key: 'grossProfit', label: 'Gross profit' } as const;

/** Every item sold in the period, ranked; sortable and searchable. */
export function ItemsTable({ items }: { items: ItemSales[] }) {
    const [sort, setSort] = useState<SortKey>('sales');
    const [query, setQuery] = useState('');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState<PageSize>(15);
    const hasCosts = items.some((item) => item.grossProfit !== null);
    const sorts = hasCosts ? [...SORTS, PROFIT_SORT] : SORTS;

    const ranked = useMemo(() => {
        const needle = query.trim().toLowerCase();

        return [...items]
            .sort(
                (a, b) =>
                    (b[sort] ?? -Infinity) - (a[sort] ?? -Infinity) ||
                    b.sales - a.sales,
            )
            .map((item, index) => ({ ...item, rank: index + 1 }))
            .filter(
                (item) =>
                    !needle ||
                    `${item.code} ${item.description}`
                        .toLowerCase()
                        .includes(needle),
            );
    }, [items, sort, query]);

    const pagination = paginate(ranked, page, pageSize);

    return (
        <div className="grid grid-cols-1 gap-3">
            <label className="relative w-full sm:w-72 print:hidden">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                    aria-label="Search items"
                    placeholder="Search item or code…"
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setPage(1);
                    }}
                    className="pl-8"
                />
            </label>
            <div className="rounded-xl border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-12">#</TableHead>
                            <TableHead>Item</TableHead>
                            {sorts.map(({ key, label }) => (
                                <TableHead key={key} className="text-right">
                                    <button
                                        type="button"
                                        onClick={() => setSort(key)}
                                        className={cn(
                                            'inline-flex items-center gap-1',
                                            sort === key && 'text-primary',
                                        )}
                                        aria-label={`Rank by ${label}`}
                                    >
                                        {label}
                                        <ArrowDownUp className="size-3 print:hidden" />
                                    </button>
                                </TableHead>
                            ))}
                            {hasCosts && (
                                <TableHead className="text-right">
                                    Margin
                                </TableHead>
                            )}
                            <TableHead className="text-right">Share</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {pagination.visible.map((item) => (
                            <TableRow key={item.code}>
                                <TableCell className="text-muted-foreground tabular-nums">
                                    {item.rank}
                                </TableCell>
                                <TableCell className="max-w-72 whitespace-normal">
                                    <div className="font-medium">
                                        {item.description}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        {item.code}
                                        {item.uom && ` · ${item.uom}`}
                                    </div>
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {formatQty(item.qty)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {formatMoney(item.sales)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {formatMoney(item.averagePrice)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {item.storeCount}
                                </TableCell>
                                {hasCosts && (
                                    <ProfitCells
                                        grossProfit={item.grossProfit}
                                        grossMargin={item.grossMargin}
                                    />
                                )}
                                <TableCell className="text-right tabular-nums">
                                    {formatPercent(item.share)}
                                </TableCell>
                            </TableRow>
                        ))}
                        {!pagination.visible.length && (
                            <TableRow>
                                <TableCell
                                    colSpan={hasCosts ? 9 : 7}
                                    className="py-10 text-center text-muted-foreground"
                                >
                                    No items match.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
            <div className="print:hidden">
                <TablePagination
                    count={ranked.length}
                    totalCount={items.length}
                    pagination={pagination}
                    pageSize={pageSize}
                    onPageChange={setPage}
                    onPageSizeChange={(size) => {
                        setPageSize(size);
                        setPage(1);
                    }}
                    label="Items per page"
                />
            </div>
        </div>
    );
}
