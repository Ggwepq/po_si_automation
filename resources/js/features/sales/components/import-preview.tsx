import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatMoney } from '../lib/format';
import { previewTotals, summaryPreviewTotals } from '../lib/read-dsr-file';
import type { ParsedSalesFile } from '../lib/types';

type Props = {
    parsed: ParsedSalesFile;
    busy: boolean;
    progress: { done: number; total: number } | null;
    onImport: () => void;
};

const dateRange = (first: string | null, last: string | null) =>
    first === last ? first : `${first} to ${last}`;

/** "Check before importing": totals of the selected file, then the import button. */
export function ImportPreview({ parsed, busy, progress, onImport }: Props) {
    const facts =
        parsed.kind === 'summary'
            ? summaryFacts(parsed.summaries)
            : detailFacts(parsed.reports);

    return (
        <section className="grid gap-4 rounded-xl border bg-card p-4">
            <div className="space-y-1">
                <h2 className="text-base font-semibold">
                    Check before importing
                </h2>
                {parsed.kind === 'summary' && (
                    <p className="text-sm text-muted-foreground">
                        This is SM&apos;s DSR Summary. It is used to check the
                        imported DSRs at month-end and does not add to sales.
                    </p>
                )}
            </div>
            <dl className="grid gap-3 text-sm sm:grid-cols-4">
                {facts.items.map(([label, value]) => (
                    <div key={label}>
                        <dt className="text-muted-foreground">{label}</dt>
                        <dd className="font-medium">{value}</dd>
                    </div>
                ))}
            </dl>
            {parsed.warnings.length > 0 && (
                <ul className="list-inside list-disc text-sm text-amber-700 dark:text-amber-400">
                    {parsed.warnings.slice(0, 8).map((warning) => (
                        <li key={warning}>{warning}</li>
                    ))}
                    {parsed.warnings.length > 8 && (
                        <li>…and {parsed.warnings.length - 8} more</li>
                    )}
                </ul>
            )}
            <div className="flex items-center gap-3">
                <Button disabled={busy} onClick={onImport}>
                    <Upload /> {facts.action}
                </Button>
                {progress && (
                    <span
                        className="text-sm text-muted-foreground"
                        role="status"
                    >
                        Saving part {progress.done + 1} of {progress.total}…
                    </span>
                )}
            </div>
        </section>
    );
}

function detailFacts(reports: Parameters<typeof previewTotals>[0]) {
    const t = previewTotals(reports);

    return {
        action: `Import ${t.reportCount} store-days`,
        items: [
            ['Dates', dateRange(t.firstDate, t.lastDate)],
            ['Stores', t.storeCount],
            ['Item lines', t.lineCount.toLocaleString()],
            ['Total sales', formatMoney(t.totalSales)],
        ] as const,
    };
}

function summaryFacts(summaries: Parameters<typeof summaryPreviewTotals>[0]) {
    const t = summaryPreviewTotals(summaries);

    return {
        action: `Import DSR Summary (${t.rowCount} store-days)`,
        items: [
            ['Dates', dateRange(t.firstDate, t.lastDate)],
            ['Stores', t.storeCount],
            ['Days with 0.00 sales', t.noSalesDays],
            ['Total sales (SM)', formatMoney(t.totalSales)],
        ] as const,
    };
}
