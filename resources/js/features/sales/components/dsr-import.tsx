import { Link } from '@inertiajs/react';
import { BarChart3, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import AlertError from '@/components/alert-error';
import { Button } from '@/components/ui/button';
import { UploadCard } from '@/components/workbook/upload-card';
import { report as reportRoute } from '@/routes/sales';
import { readDsrFile, toBatches } from '../lib/read-dsr-file';
import type { ParsedSalesFile } from '../lib/types';
import { postImportBatch } from '../post-import-batch';
import type { ImportBatch, ImportResult } from '../post-import-batch';
import { ImportHistory } from './import-history';
import type { ImportRecord } from './import-history';
import { ImportPreview } from './import-preview';

type Props = {
    imports: ImportRecord[];
    limits: {
        reportsPerBatch: number;
        linesPerReport: number;
        summariesPerBatch: number;
    };
};

type Imported = ImportResult & { kind: ParsedSalesFile['kind'] };

function assertWithinLimits(parsed: ParsedSalesFile, maxLines: number): void {
    if (parsed.kind !== 'detail') {
        return;
    }

    const tooLong = parsed.reports.find((r) => r.lines.length > maxLines);

    if (tooLong) {
        throw new Error(
            `${tooLong.site_name} on ${tooLong.transaction_date} has more than ${maxLines} lines.`,
        );
    }
}

function batchesOf(
    parsed: ParsedSalesFile,
    limits: Props['limits'],
): ImportBatch[] {
    return parsed.kind === 'summary'
        ? toBatches(parsed.summaries, limits.summariesPerBatch).map((rows) => ({
              kind: 'summary',
              rows,
          }))
        : toBatches(parsed.reports, limits.reportsPerBatch).map((rows) => ({
              kind: 'detail',
              rows,
          }));
}

export function DsrImport({ imports, limits }: Props) {
    const [file, setFile] = useState<{
        name: string;
        parsed: ParsedSalesFile;
    } | null>(null);
    const [busy, setBusy] = useState(false);
    const [progress, setProgress] = useState<{
        done: number;
        total: number;
    } | null>(null);
    const [result, setResult] = useState<Imported | null>(null);
    const [error, setError] = useState('');

    const select = async (selected: File) => {
        setBusy(true);
        setError('');
        setResult(null);

        try {
            const parsed = await readDsrFile(selected);
            assertWithinLimits(parsed, limits.linesPerReport);
            setFile({ name: selected.name, parsed });
        } catch (e) {
            setFile(null);
            setError((e as Error).message);
        } finally {
            setBusy(false);
        }
    };

    const runImport = async () => {
        if (!file) {
            return;
        }

        const batches = batchesOf(file.parsed, limits);
        const total: Imported = {
            kind: file.parsed.kind,
            reportCount: 0,
            lineCount: 0,
            replacedCount: 0,
        };
        setBusy(true);
        setError('');

        try {
            for (const [index, batch] of batches.entries()) {
                setProgress({ done: index, total: batches.length });
                const name =
                    batches.length > 1
                        ? `${file.name} (part ${index + 1} of ${batches.length})`
                        : file.name;
                const saved = await postImportBatch(name, batch);
                total.reportCount += saved.reportCount;
                total.lineCount += saved.lineCount;
                total.replacedCount += saved.replacedCount;
            }

            setResult(total);
            setFile(null);
        } catch (e) {
            setError(
                `Import stopped: ${(e as Error).message} Batches before this one were saved; re-importing the file is safe.`,
            );
        } finally {
            setBusy(false);
            setProgress(null);
        }
    };

    return (
        <div className="grid grid-cols-1 gap-6 p-4 md:p-6">
            <header className="space-y-1">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Sales
                </p>
                <h1 className="text-2xl font-semibold tracking-tight">
                    Import DSR
                </h1>
                <p className="text-sm text-muted-foreground">
                    Upload a Daily Sales Report (Export Document) or the DSR
                    Summary from the SM Vendor Portal. The Summary is used to
                    check the month. Re-importing a store and date replaces it,
                    so nothing is counted twice.
                </p>
            </header>

            <div className="max-w-xl">
                <UploadCard
                    title="DSR or DSR Summary export"
                    subtitle="Exported from the SM Vendor Portal"
                    accept={['.xlsx', '.xls', '.csv']}
                    busy={busy && !progress}
                    loaded={
                        file && {
                            fileName: file.name,
                            rowCount:
                                file.parsed.kind === 'summary'
                                    ? file.parsed.summaries.length
                                    : file.parsed.reports.length,
                            rowLabel: 'store-days',
                        }
                    }
                    onSelect={(selected) => void select(selected)}
                />
            </div>

            {error && (
                <AlertError
                    title="The file could not be imported"
                    errors={[error]}
                />
            )}

            {result && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
                    <p className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="size-5 text-emerald-600" />
                        {result.kind === 'summary'
                            ? `Imported the DSR Summary for ${result.reportCount} store-days`
                            : `Imported ${result.reportCount} store-days (${result.lineCount} item lines)`}
                        {result.replacedCount > 0 &&
                            `, ${result.replacedCount} replaced with newer data`}
                        .
                    </p>
                    <Button asChild size="sm">
                        <Link href={reportRoute()}>
                            <BarChart3 /> View sales report
                        </Link>
                    </Button>
                </div>
            )}

            {file && (
                <ImportPreview
                    parsed={file.parsed}
                    busy={busy}
                    progress={progress}
                    onImport={() => void runImport()}
                />
            )}

            <ImportHistory imports={imports} />
        </div>
    );
}
