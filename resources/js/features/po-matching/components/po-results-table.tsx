import { ChevronRight } from 'lucide-react';
import { Fragment, useState } from 'react';
import { StatusBadge } from '@/components/workbook/result-widgets';
import type { Tone } from '@/components/workbook/result-widgets';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { DeliveryStatus } from '../lib/types';
import type { DeliveryResult } from '../lib/types';

const statusTone: Record<DeliveryStatus, Tone> = {
    [DeliveryStatus.Delivered]: 'positive',
    [DeliveryStatus.Undelivered]: 'warning',
    [DeliveryStatus.NeedsReview]: 'attention',
};

function ResultRow({ result }: { result: DeliveryResult }) {
    const [open, setOpen] = useState(false);

    return (
        <Fragment>
            <TableRow>
                <TableCell>
                    <button
                        type="button"
                        className="inline-flex items-center gap-1.5 font-mono"
                        aria-expanded={open}
                        aria-label={`${open ? 'Hide' : 'Show'} item details for ${result.poNumber || 'blank PO'}`}
                        onClick={() => setOpen(!open)}
                    >
                        <ChevronRight
                            className={cn(
                                'size-3.5 transition-transform',
                                open && 'rotate-90',
                            )}
                        />
                        {result.poNumber || 'Missing PO number'}
                    </button>
                </TableCell>
                <TableCell className="font-mono text-muted-foreground">
                    {result.grPO || '—'}
                </TableCell>
                <TableCell>{result.vendorCode || '—'}</TableCell>
                <TableCell>{result.vendorName || '—'}</TableCell>
                <TableCell>
                    <StatusBadge tone={statusTone[result.status]}>
                        {result.status}
                    </StatusBadge>
                </TableCell>
            </TableRow>
            {open && (
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableCell colSpan={5} className="whitespace-normal">
                        <p className="mb-3 text-sm">
                            Matched receipt numbers:{' '}
                            <strong>
                                {result.receiptNumbers.join(', ') || 'None'}
                            </strong>
                        </p>
                        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
                            {Object.entries(result.original).map(
                                ([key, value]) => (
                                    <div key={key}>
                                        <dt className="text-xs text-muted-foreground">
                                            {key}
                                        </dt>
                                        <dd>{value || '—'}</dd>
                                    </div>
                                ),
                            )}
                        </dl>
                    </TableCell>
                </TableRow>
            )}
        </Fragment>
    );
}

export function PoResultsTable({ rows }: { rows: DeliveryResult[] }) {
    return (
        <div className="rounded-xl border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>PO No.</TableHead>
                        <TableHead>Matched GR PO No.</TableHead>
                        <TableHead>Vendor code</TableHead>
                        <TableHead>Vendor name</TableHead>
                        <TableHead>Remarks</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {rows.map((row) => (
                        <ResultRow key={row.id} result={row} />
                    ))}
                    {!rows.length && (
                        <TableRow>
                            <TableCell
                                colSpan={5}
                                className="py-10 text-center text-muted-foreground"
                            >
                                No item rows match your search or filter.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
}
