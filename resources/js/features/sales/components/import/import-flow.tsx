import { Link } from '@inertiajs/react';
import { ArrowRight, CheckCircle2, RotateCcw, Upload } from 'lucide-react';
import AlertError from '@/components/alert-error';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { UploadCard } from '@/components/workbook/upload-card';
import {
    liquidation as liquidationRoute,
    report as reportRoute,
} from '@/routes/sales';
import { importFacts, KIND_LABELS, KIND_PURPOSE } from '../../lib/import-plan';
import { ImportSteps } from './import-steps';
import type { ImportedFile } from './use-sales-import';
import { useSalesImport } from './use-sales-import';

/** Where to look at what was just imported. */
function nextPage(result: ImportedFile) {
    const facts = importFacts(result.parsed);

    if (result.parsed.kind === 'csr' || result.parsed.kind === 'clr') {
        return { label: 'View liquidation', href: liquidationRoute() };
    }

    return {
        label: 'View sales report',
        href: reportRoute({
            query: facts.lastDate
                ? { period: 'monthly', date: facts.lastDate }
                : {},
        }),
    };
}

/**
 * Choose a file → review what it contains → done. Any SM export is accepted:
 * DSR, DSR Summary, Consolidated Sales Report or Consolidated Liquidation Report.
 */
export function ImportFlow({ onFinished }: { onFinished?: () => void }) {
    const flow = useSalesImport();
    const facts = flow.file ? importFacts(flow.file.parsed) : null;

    return (
        <div className="grid gap-5">
            <ImportSteps step={flow.step} />

            {flow.step === 'choose' && (
                <UploadCard
                    title="Drop an SM Vendor Portal export"
                    subtitle="DSR, DSR Summary, Consolidated Sales Report (CSR) or Consolidated Liquidation Report (CLR)"
                    accept={['.xlsx', '.xls', '.csv']}
                    busy={flow.reading}
                    loaded={null}
                    onSelect={(selected) => void flow.select(selected)}
                />
            )}

            {flow.error && (
                <AlertError
                    title="The file could not be imported"
                    errors={[flow.error]}
                />
            )}

            {flow.step === 'review' && flow.file && facts && (
                <section className="grid gap-4 rounded-xl border bg-card p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="secondary">
                                    {KIND_LABELS[flow.file.parsed.kind]}
                                </Badge>
                                <span
                                    className="truncate text-sm font-medium"
                                    title={flow.file.name}
                                >
                                    {flow.file.name}
                                </span>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                {KIND_PURPOSE[flow.file.parsed.kind]}
                            </p>
                        </div>
                    </div>
                    <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                        {facts.facts.map(([label, value]) => (
                            <div key={label}>
                                <dt className="text-muted-foreground">
                                    {label}
                                </dt>
                                <dd className="font-medium">{value}</dd>
                            </div>
                        ))}
                    </dl>
                    {flow.file.parsed.warnings.length > 0 && (
                        <ul className="list-inside list-disc text-sm text-amber-700 dark:text-amber-400">
                            {flow.file.parsed.warnings
                                .slice(0, 8)
                                .map((warning) => (
                                    <li key={warning}>{warning}</li>
                                ))}
                            {flow.file.parsed.warnings.length > 8 && (
                                <li>
                                    …and {flow.file.parsed.warnings.length - 8}{' '}
                                    more
                                </li>
                            )}
                        </ul>
                    )}
                    <p className="text-xs text-muted-foreground">
                        Importing the same dates again replaces them, so nothing
                        is counted twice.
                    </p>
                    <div className="flex flex-wrap items-center gap-3">
                        <Button
                            disabled={flow.saving !== null}
                            onClick={() => void flow.run()}
                        >
                            {flow.saving ? <Spinner /> : <Upload />}
                            {facts.action}
                        </Button>
                        <Button
                            variant="ghost"
                            disabled={flow.saving !== null}
                            onClick={flow.reset}
                        >
                            Choose another file
                        </Button>
                        {flow.saving && flow.saving.total > 1 && (
                            <span
                                className="text-sm text-muted-foreground"
                                role="status"
                            >
                                Saving part {flow.saving.done + 1} of{' '}
                                {flow.saving.total}…
                            </span>
                        )}
                    </div>
                </section>
            )}

            {flow.step === 'done' && flow.result && (
                <section className="grid gap-4 rounded-xl border bg-card p-4">
                    <p className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
                        <span>
                            Imported {KIND_LABELS[flow.result.parsed.kind]}:{' '}
                            {flow.result.reportCount}{' '}
                            {importFacts(flow.result.parsed).unit}
                            {flow.result.lineCount > 0 &&
                                ` (${flow.result.lineCount.toLocaleString()} lines)`}
                            {flow.result.replacedCount > 0 &&
                                `, ${flow.result.replacedCount} replaced with the newer file`}
                            .
                        </span>
                    </p>
                    <div className="flex flex-wrap gap-2">
                        <Button asChild size="sm">
                            <Link
                                href={nextPage(flow.result).href}
                                onClick={onFinished}
                            >
                                {nextPage(flow.result).label}
                                <ArrowRight />
                            </Link>
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={flow.reset}
                        >
                            <RotateCcw />
                            Import another file
                        </Button>
                    </div>
                </section>
            )}
        </div>
    );
}
