import { ArrowRight, Download } from 'lucide-react';
import type { ReactNode } from 'react';
import AlertError from '@/components/alert-error';
import { Button } from '@/components/ui/button';
import { TablePagination } from '@/components/workbook/table-pagination';
import {
    LocalProcessingTag,
    ResultsToolbar,
    SectionHeading,
    StatCard,
} from '@/components/workbook/result-widgets';
import { UploadCard } from '@/components/workbook/upload-card';
import { paginate } from '@/lib/paginate';
import { exportResults } from '../lib/workbooks';
import {
    PO_FILTERS,
    clearPoError,
    poStore,
    resetPo,
    setPoFilter,
    setPoPage,
    setPoPageSize,
    setPoQuery,
    setPoView,
    uploadPoFile,
    usePoWorkspace,
} from '../store';
import type { PoKind } from '../store';
import { ColumnSettings } from './column-settings';
import { InvoicePreview } from './invoice-preview';
import { PoResultsTable } from './po-results-table';

const UPLOADS: { kind: PoKind; title: string; subtitle: string }[] = [
    { kind: 'po', title: 'PO Details', subtitle: 'Your purchase orders' },
    { kind: 'gr', title: 'GR Details', subtitle: 'Your goods receipts' },
];

export function PoWorkspace() {
    const workspace = usePoWorkspace();
    const { files, busy, ready, processing, results, counts, filtered } =
        workspace;

    const uploadCards = (compact: boolean) =>
        UPLOADS.map(({ kind, title, subtitle }) => (
            <UploadCard
                key={kind}
                title={title}
                subtitle={subtitle}
                compact={compact}
                busy={busy[kind]}
                loaded={
                    files[kind] && {
                        fileName: files[kind].fileName,
                        rowCount: files[kind].rows.length,
                        rowLabel: 'item rows',
                    }
                }
                onSelect={(file) => void uploadPoFile(kind, file)}
            />
        ));

    const download = () => {
        try {
            if (files.po) {
                exportResults(results, files.po.headers);
            }
        } catch (error) {
            poStore.set({
                error: `Could not export the workbook: ${(error as Error).message}`,
            });
        }
    };

    return (
        <div className="grid gap-6 p-4 md:p-6">
            <header className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1">
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                        PO & SI workflow
                    </p>
                    <h1 className="text-2xl font-semibold tracking-tight">
                        Automated SI & PO workflow
                    </h1>
                    {!ready && (
                        <p className="text-sm text-muted-foreground">
                            Upload purchase orders and goods receipts to check
                            delivery remarks.
                        </p>
                    )}
                </div>
                {ready && (
                    <div className="grid w-full gap-2 sm:w-auto sm:grid-cols-2">
                        {uploadCards(true)}
                    </div>
                )}
            </header>

            {workspace.error && (
                <div className="grid gap-2">
                    <AlertError
                        title="There was a problem"
                        errors={[workspace.error]}
                    />
                    <Button
                        variant="ghost"
                        size="sm"
                        className="justify-self-start"
                        onClick={clearPoError}
                    >
                        Dismiss
                    </Button>
                </div>
            )}

            {!ready ? (
                <section className="grid gap-4">
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                        01 · Upload your workbooks
                    </p>
                    <div className="grid items-center gap-4 md:grid-cols-[1fr_auto_1fr]">
                        {uploadCards(false).flatMap((card, index) =>
                            index === 0
                                ? [card]
                                : [
                                      <ArrowRight
                                          key="arrow"
                                          className="hidden size-5 text-muted-foreground md:block"
                                      />,
                                      card,
                                  ],
                        )}
                    </div>
                </section>
            ) : (
                <>
                    <nav
                        className="flex flex-wrap items-center gap-2 border-b pb-2"
                        aria-label="Workflow views"
                    >
                        {(
                            [
                                ['results', '01 · Remarks checker'],
                                ['invoices', '02 · Sales invoices (pending)'],
                            ] as const
                        ).map(([view, label]) => (
                            <Button
                                key={view}
                                variant={
                                    workspace.view === view
                                        ? 'secondary'
                                        : 'ghost'
                                }
                                size="sm"
                                onClick={() => setPoView(view)}
                            >
                                {label}
                            </Button>
                        ))}
                        <Button
                            variant="ghost"
                            size="sm"
                            className="ml-auto"
                            disabled={processing}
                            onClick={resetPo}
                        >
                            Start over
                        </Button>
                    </nav>

                    {processing && (
                        <p
                            className="text-sm text-muted-foreground"
                            role="status"
                        >
                            Reading replacement workbook…
                        </p>
                    )}

                    {workspace.view === 'invoices' ? (
                        <InvoicePreview results={results} />
                    ) : (
                        counts &&
                        files.po &&
                        files.gr && (
                            <PoResults
                                workspace={workspace}
                                counts={counts}
                                onDownload={download}
                                settings={
                                    <ColumnSettings
                                        po={files.po}
                                        gr={files.gr}
                                    />
                                }
                                filteredCount={filtered.length}
                            />
                        )
                    )}
                </>
            )}
        </div>
    );
}

type Workspace = ReturnType<typeof usePoWorkspace>;

function PoResults({
    workspace,
    counts,
    settings,
    onDownload,
    filteredCount,
}: {
    workspace: Workspace;
    counts: NonNullable<Workspace['counts']>;
    settings: ReactNode;
    onDownload: () => void;
    filteredCount: number;
}) {
    const { results, filtered, processing } = workspace;
    const pagination = paginate(filtered, workspace.page, workspace.pageSize);
    const filters = PO_FILTERS.filter(
        (f) => f !== 'Needs review' || counts.review > 0,
    );

    return (
        <section className="grid gap-6">
            <SectionHeading
                title="Remarks checker"
                description="Delivery status, matched against your goods receipts."
                action={<LocalProcessingTag />}
            />

            <div className="grid gap-4 sm:grid-cols-3">
                <StatCard
                    label="Total POs"
                    value={counts.total}
                    hint={`${results.length.toLocaleString()} item rows`}
                />
                <StatCard
                    label="Delivered"
                    tone="positive"
                    value={counts.delivered}
                    hint="PO number found in GR"
                />
                <StatCard
                    label="Undelivered"
                    tone="warning"
                    value={counts.undelivered}
                    hint="No match in uploaded GR"
                />
            </div>

            {counts.unmatchedGR > 0 && (
                <p className="text-sm text-muted-foreground">
                    {counts.unmatchedGR} PO number
                    {counts.unmatchedGR === 1 ? '' : 's'} in GR{' '}
                    {counts.unmatchedGR === 1 ? 'is' : 'are'} absent from the PO
                    upload.
                    {counts.delivered === 0 &&
                        ' No PO numbers match between these files.'}
                </p>
            )}
            {counts.review > 0 && (
                <p className="text-sm text-muted-foreground">
                    {counts.review} item rows have a blank PO number and need
                    review.
                </p>
            )}

            <ResultsToolbar
                filters={filters}
                filter={workspace.filter}
                onFilterChange={setPoFilter}
                query={workspace.query}
                onQueryChange={setPoQuery}
                filterLabel="Delivery status filter"
                searchLabel="Search PO, vendor, or receipt"
                searchPlaceholder="Search PO or vendor…"
            />

            <div className="grid gap-3">
                <PoResultsTable rows={pagination.visible} />
                <TablePagination
                    count={filteredCount}
                    totalCount={results.length}
                    pagination={pagination}
                    pageSize={workspace.pageSize}
                    onPageChange={setPoPage}
                    onPageSizeChange={setPoPageSize}
                    label="PO rows per page"
                />
            </div>

            {settings}

            <footer className="flex flex-wrap items-center justify-between gap-4 border-t pt-4">
                <p className="text-sm">
                    Any PO match marks the PO delivered.
                    <br />
                    <span className="text-muted-foreground">
                        Quantity and partial delivery are not checked.
                    </span>
                </p>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        disabled
                        title="Sales invoice template is required"
                    >
                        Generate SI
                    </Button>
                    <Button disabled={processing} onClick={onDownload}>
                        <Download /> Export to xlsx
                    </Button>
                </div>
            </footer>
            <p className="text-xs text-muted-foreground">
                Export includes all {results.length.toLocaleString()} item rows
                and the original PO columns, regardless of filters. Sales
                invoice generation is awaiting your template.
            </p>
        </section>
    );
}
