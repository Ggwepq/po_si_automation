import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';

const KIND_SHORT: Record<ImportRecord['kind'], string> = {
    detail: 'DSR',
    summary: 'DSR Summary',
    csr: 'CSR',
    clr: 'CLR',
};

export type ImportRecord = {
    id: number;
    fileName: string;
    kind: 'detail' | 'summary' | 'csr' | 'clr';
    reportCount: number;
    lineCount: number;
    replacedCount: number;
    firstDate: string | null;
    lastDate: string | null;
    importedBy: string | null;
    importedAt: string | null;
};

export function ImportHistory({ imports }: { imports: ImportRecord[] }) {
    return (
        <section className="grid grid-cols-1 gap-3">
            <h2 className="text-base font-semibold">Recent imports</h2>
            <div className="rounded-xl border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>File</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Sales dates</TableHead>
                            <TableHead className="text-right">Rows</TableHead>
                            <TableHead className="text-right">Lines</TableHead>
                            <TableHead className="text-right">
                                Replaced
                            </TableHead>
                            <TableHead>Imported</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {imports.map((record) => (
                            <TableRow key={record.id}>
                                <TableCell
                                    className="max-w-64 truncate"
                                    title={record.fileName}
                                >
                                    {record.fileName}
                                </TableCell>
                                <TableCell className="whitespace-nowrap">
                                    {KIND_SHORT[record.kind]}
                                </TableCell>
                                <TableCell>
                                    {record.firstDate === record.lastDate
                                        ? record.firstDate
                                        : `${record.firstDate} to ${record.lastDate}`}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {record.reportCount}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {record.lineCount}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {record.replacedCount}
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                    {record.importedAt &&
                                        new Date(
                                            record.importedAt,
                                        ).toLocaleString('en-PH')}
                                    {record.importedBy &&
                                        ` · ${record.importedBy}`}
                                </TableCell>
                            </TableRow>
                        ))}
                        {!imports.length && (
                            <TableRow>
                                <TableCell
                                    colSpan={7}
                                    className="py-8 text-center text-muted-foreground"
                                >
                                    No imports yet.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </section>
    );
}
