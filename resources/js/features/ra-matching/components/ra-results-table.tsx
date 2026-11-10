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
import { MatchStatus } from '../lib/types';
import type { RAResult } from '../lib/types';

const statusTone: Record<MatchStatus, Tone> = {
    [MatchStatus.Matched]: 'positive',
    [MatchStatus.NotMatched]: 'warning',
    [MatchStatus.NeedsReview]: 'attention',
};

function statusNote(row: RAResult): string | null {
    if (row.status === MatchStatus.NeedsReview) {
        return row.reason;
    }

    return row.fallback ? 'Outside selected months' : null;
}

export function RAResultsTable({ rows }: { rows: RAResult[] }) {
    return (
        <div className="rounded-xl border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>RA row</TableHead>
                        <TableHead>Document Reference</TableHead>
                        <TableHead>Current ITEM</TableHead>
                        <TableHead>Updated ITEM</TableHead>
                        <TableHead>ICR month</TableHead>
                        <TableHead>Status</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {rows.map((row) => {
                        const note = statusNote(row);

                        return (
                            <TableRow key={row.rowIndex}>
                                <TableCell className="text-muted-foreground tabular-nums">
                                    {row.rowIndex + 1}
                                </TableCell>
                                <TableCell className="font-mono">
                                    {row.reference || '—'}
                                </TableCell>
                                <TableCell>{row.existingItem || '—'}</TableCell>
                                <TableCell className="font-semibold">
                                    {row.outputItem || '—'}
                                </TableCell>
                                <TableCell>
                                    {row.months.join(', ') || '—'}
                                </TableCell>
                                <TableCell className="whitespace-normal">
                                    <div className="grid gap-1">
                                        <StatusBadge
                                            tone={statusTone[row.status]}
                                        >
                                            {row.status}
                                        </StatusBadge>
                                        {note && (
                                            <span className="text-xs text-muted-foreground">
                                                {note}
                                            </span>
                                        )}
                                    </div>
                                </TableCell>
                            </TableRow>
                        );
                    })}
                    {!rows.length && (
                        <TableRow>
                            <TableCell
                                colSpan={6}
                                className="py-10 text-center text-muted-foreground"
                            >
                                No matching rows.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
}
