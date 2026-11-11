import { Link, router } from '@inertiajs/react';
import { BarChart3, CheckCircle2, Upload } from 'lucide-react';
import { useState } from 'react';
import AlertError from '@/components/alert-error';
import { Button } from '@/components/ui/button';
import { UploadCard } from '@/components/workbook/upload-card';
import { report as reportRoute } from '@/routes/sales';
import { store as storeRoute } from '@/routes/sales/import';
import { formatMoney } from '../lib/format';
import { previewTotals, readDsrFile, toBatches } from '../lib/read-dsr-file';
import type { DsrReportInput, ParsedDsrFile } from '../lib/types';
import { ImportHistory } from './import-history';
import type { ImportRecord } from './import-history';

type Props = {
    imports: ImportRecord[];
    limits: { reportsPerBatch: number; linesPerReport: number };
};

type Result = { reportCount: number; lineCount: number; replacedCount: number };

/**
 * Posts one batch and resolves with the server's import summary. Always
 * settles: a response without the summary (a server or network failure)
 * rejects instead of leaving the import waiting forever.
 */
function postBatch(
    fileName: string,
    reports: DsrReportInput[],
): Promise<Result> {
    return new Promise((resolve, reject) => {
        let summary: Result | null = null;
        let failure: Error | null = null;

        router.post(
            storeRoute().url,
            { file_name: fileName, reports },
            {
                preserveScroll: true,
                preserveState: true,
                onFlash: (flash) => {
                    summary =
                        (flash as { importResult?: Result } | undefined)
                            ?.importResult ?? null;
                },
                onError: (errors) => {
                    failure = new Error(
                        Object.values(errors).slice(0, 3).join(' '),
                    );
                },
                onFinish: () => {
                    if (summary) {
                        resolve(summary);
                    } else {
                        reject(
                            failure ??
                                new Error(
                                    'The server did not accept the import. Try again, or contact the administrator if it keeps failing.',
                                ),
                        );
                    }
                },
            },
        );
    });
}

export function DsrImport({ imports, limits }: Props) {
    const [file, setFile] = useState<{
        name: string;
        parsed: ParsedDsrFile;
    } | null>(null);
    const [busy, setBusy] = useState(false);
    const [progress, setProgress] = useState<{
        done: number;
        total: number;
    } | null>(null);
    const [result, setResult] = useState<Result | null>(null);
    const [error, setError] = useState('');

    const select = async (selected: File) => {
        setBusy(true);
        setError('');
        setResult(null);

        try {
            const parsed = await readDsrFile(selected);
            const tooLong = parsed.reports.find(
                (r) => r.lines.length > limits.linesPerReport,
            );

            if (tooLong) {
                throw new Error(
                    `${tooLong.site_name} on ${tooLong.transaction_date} has more than ${limits.linesPerReport} lines.`,
                );
            }

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

        const batches = toBatches(file.parsed.reports, limits.reportsPerBatch);
        const total: Result = {
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
                const saved = await postBatch(name, batch);
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

    const preview = file && previewTotals(file.parsed.reports);

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
                    Upload a Daily Sales Report exported from the SM Vendor
                    Portal. Re-importing a store and date replaces it, so
                    nothing is counted twice.
                </p>
            </header>

            <div className="max-w-xl">
                <UploadCard
                    title="DSR export"
                    subtitle="Exported from the SM Vendor Portal"
                    accept={['.xlsx', '.xls', '.csv']}
                    busy={busy && !progress}
                    loaded={
                        file && {
                            fileName: file.name,
                            rowCount: file.parsed.reports.length,
                            rowLabel: 'store-days',
                        }
                    }
                    onSelect={(selected) => void select(selected)}
                />
            </div>

            {error && (
                <AlertError
                    title="The DSR could not be imported"
                    errors={[error]}
                />
            )}

            {result && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
                    <p className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="size-5 text-emerald-600" />
                        Imported {result.reportCount} store-days (
                        {result.lineCount} item lines)
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

            {file && preview && (
                <section className="grid gap-4 rounded-xl border bg-card p-4">
                    <h2 className="text-base font-semibold">
                        Check before importing
                    </h2>
                    <dl className="grid gap-3 text-sm sm:grid-cols-4">
                        <div>
                            <dt className="text-muted-foreground">Dates</dt>
                            <dd className="font-medium">
                                {preview.firstDate === preview.lastDate
                                    ? preview.firstDate
                                    : `${preview.firstDate} to ${preview.lastDate}`}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-muted-foreground">Stores</dt>
                            <dd className="font-medium">
                                {preview.storeCount}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-muted-foreground">
                                Item lines
                            </dt>
                            <dd className="font-medium">
                                {preview.lineCount.toLocaleString()}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-muted-foreground">
                                Total sales
                            </dt>
                            <dd className="font-medium">
                                {formatMoney(preview.totalSales)}
                            </dd>
                        </div>
                    </dl>
                    {file.parsed.warnings.length > 0 && (
                        <ul className="list-inside list-disc text-sm text-amber-700 dark:text-amber-400">
                            {file.parsed.warnings.slice(0, 8).map((warning) => (
                                <li key={warning}>{warning}</li>
                            ))}
                            {file.parsed.warnings.length > 8 && (
                                <li>
                                    …and {file.parsed.warnings.length - 8} more
                                </li>
                            )}
                        </ul>
                    )}
                    <div className="flex items-center gap-3">
                        <Button
                            disabled={busy}
                            onClick={() => void runImport()}
                        >
                            <Upload /> Import {preview.reportCount} store-days
                        </Button>
                        {progress && (
                            <span
                                className="text-sm text-muted-foreground"
                                role="status"
                            >
                                Saving part {progress.done + 1} of{' '}
                                {progress.total}…
                            </span>
                        )}
                    </div>
                </section>
            )}

            <ImportHistory imports={imports} />
        </div>
    );
}
