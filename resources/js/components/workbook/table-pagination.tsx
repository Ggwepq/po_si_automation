import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { PAGE_SIZES } from '@/lib/paginate';
import type { PageSize, Paginated } from '@/lib/paginate';

type Props = {
    /** Rows after filtering. */
    count: number;
    /** Rows before filtering. */
    totalCount: number;
    pagination: Paginated<unknown>;
    pageSize: PageSize;
    onPageChange: (page: number) => void;
    onPageSizeChange: (size: PageSize) => void;
    label?: string;
};

export function TablePagination({
    count,
    totalCount,
    pagination: { page, pages, size },
    pageSize,
    onPageChange,
    onPageSizeChange,
    label = 'Rows per page',
}: Props) {
    const range = count
        ? `${(page - 1) * size + 1}–${Math.min(page * size, count)} of ${count.toLocaleString()}`
        : '0';

    return (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
            <span>
                {range} rows
                {count !== totalCount &&
                    ` · ${totalCount.toLocaleString()} total`}
            </span>
            <div className="flex items-center gap-3">
                <span className="hidden sm:inline">Rows per page</span>
                <Select
                    value={String(pageSize)}
                    onValueChange={(value) =>
                        onPageSizeChange(
                            value === 'all'
                                ? 'all'
                                : (Number(value) as PageSize),
                        )
                    }
                >
                    <SelectTrigger aria-label={label} className="h-8 w-20">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {PAGE_SIZES.map((option) => (
                            <SelectItem key={option} value={String(option)}>
                                {option}
                            </SelectItem>
                        ))}
                        <SelectItem value="all">All</SelectItem>
                    </SelectContent>
                </Select>
                <Button
                    variant="outline"
                    size="icon"
                    className="size-8"
                    disabled={page <= 1}
                    onClick={() => onPageChange(page - 1)}
                    aria-label="Previous page"
                >
                    <ChevronLeft />
                </Button>
                <span className="tabular-nums">
                    {page} / {pages}
                </span>
                <Button
                    variant="outline"
                    size="icon"
                    className="size-8"
                    disabled={page >= pages}
                    onClick={() => onPageChange(page + 1)}
                    aria-label="Next page"
                >
                    <ChevronRight />
                </Button>
            </div>
        </div>
    );
}
