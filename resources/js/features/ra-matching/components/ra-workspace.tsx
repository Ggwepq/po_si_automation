import { ArrowRight, Download } from 'lucide-react';
import AlertError from '@/components/alert-error';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    LocalProcessingTag,
    ResultsToolbar,
    SectionHeading,
    StatCard,
} from '@/components/workbook/result-widgets';
import { TablePagination } from '@/components/workbook/table-pagination';
import { UploadCard } from '@/components/workbook/upload-card';
import { paginate } from '@/lib/paginate';
import { exportRA } from '../lib/ra-export';
import {
    RA_FILTERS,
    clearRAError,
    raStore,
    resetRA,
    selectRASheet,
    setRAFilter,
    setRAPage,
    setRAPageSize,
    setRAQuery,
    uploadRAFile,
    useRAWorkspace,
} from '../store';
import { MonthSelector } from './month-selector';
import { RAResultsTable } from './ra-results-table';

export function RAWorkspace() {
    const workspace = useRAWorkspace();
    const {
        files,
        busy,
        processing,
        raSheet,
        ready,
        results,
        counts,
        filtered,
    } = workspace;
    const pagination = paginate(filtered, workspace.page, workspace.pageSize);
    const exportsAll = workspace.filter === 'All' && !workspace.query.trim();

    const download = () => {
        try {
            if (files.ra && raSheet) {
                exportRA(
                    files.ra,
                    raSheet,
                    results,
                    filtered,
                    workspace.filter,
                );
            }
        } catch (error) {
            raStore.set({
                error: `Could not export the workbook: ${(error as Error).message}`,
            });
        }
    };

    return (
        <div className="grid gap-8 p-4 md:p-6">
            <header className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1">
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                        RA_DETAIL & ICR
                    </p>
                    <h1 className="text-2xl font-semibold tracking-tight">
                        RA item matching
                    </h1>
                </div>
                <Button variant="ghost" size="sm" onClick={resetRA}>
                    Start over
                </Button>
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
                        onClick={clearRAError}
                    >
                        Dismiss
                    </Button>
                </div>
            )}

            <section className="grid gap-4">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    01 · Upload your workbooks
                </p>
                <div className="grid items-center gap-4 md:grid-cols-[1fr_auto_1fr]">
                    <UploadCard
                        title="RA_DETAIL"
                        subtitle="Document Reference and ITEM"
                        busy={busy.ra}
                        loaded={
                            files.ra && {
                                fileName: files.ra.fileName,
                                rowCount: files.ra.rows.length,
                            }
                        }
                        onSelect={(file) => void uploadRAFile('ra', file)}
                    />
                    <ArrowRight className="hidden size-5 text-muted-foreground md:block" />
                    <UploadCard
                        title="ICR workbook"
                        subtitle="Monthly SI numbers and codes"
                        busy={busy.icr}
                        loaded={
                            files.icr && {
                                fileName: files.icr.fileName,
                                rowCount: files.icr.rows.length,
                            }
                        }
                        onSelect={(file) => void uploadRAFile('icr', file)}
                    />
                </div>
                {files.ra && (
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                        <span className="text-muted-foreground">
                            RA worksheet
                        </span>
                        <Select
                            value={workspace.sheetName}
                            disabled={processing}
                            onValueChange={selectRASheet}
                        >
                            <SelectTrigger
                                aria-label="RA worksheet"
                                className="w-56"
                            >
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {files.ra.sheets.map((sheet) => (
                                    <SelectItem
                                        key={sheet.sheetName}
                                        value={sheet.sheetName}
                                    >
                                        {sheet.sheetName}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <span className="text-muted-foreground">
                            {raSheet?.rows.length.toLocaleString()} detail rows
                            {raSheet &&
                                !raSheet.hasItem &&
                                ' · ITEM column will be added'}
                        </span>
                    </div>
                )}
            </section>

            {files.icr && (
                <MonthSelector
                    icr={files.icr}
                    months={workspace.months}
                    disabled={processing}
                />
            )}

            {ready && (
                <section className="grid gap-6" aria-busy={processing}>
                    <SectionHeading
                        eyebrow="03 · Review & export"
                        title="Item matching results"
                        description={`${workspace.months.length} selected month${workspace.months.length === 1 ? '' : 's'} · ${results.length.toLocaleString()} RA rows`}
                        action={<LocalProcessingTag />}
                    />

                    {processing && (
                        <p
                            className="text-sm text-muted-foreground"
                            role="status"
                        >
                            Reading replacement workbook…
                        </p>
                    )}

                    <div className="grid gap-4 sm:grid-cols-3">
                        <StatCard
                            label="Matched"
                            tone="positive"
                            value={counts.matched}
                            hint={`${counts.fallback.toLocaleString()} found outside selected months`}
                        />
                        <StatCard
                            label="Not matched"
                            tone="warning"
                            value={counts.unmatched}
                            hint="No SI anywhere in ICR"
                        />
                        <StatCard
                            label="Needs review"
                            tone="attention"
                            value={counts.review}
                            hint="Blank reference or unclear code"
                        />
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Unmatched and review rows keep their ITEM.
                    </p>

                    <ResultsToolbar
                        filters={RA_FILTERS}
                        filter={workspace.filter}
                        onFilterChange={setRAFilter}
                        query={workspace.query}
                        onQueryChange={setRAQuery}
                        filterLabel="RA matching status filter"
                        searchLabel="Search document reference or code"
                        searchPlaceholder="Search SI number or code…"
                    />

                    <div className="grid gap-3">
                        <RAResultsTable rows={pagination.visible} />
                        <TablePagination
                            count={filtered.length}
                            totalCount={results.length}
                            pagination={pagination}
                            pageSize={workspace.pageSize}
                            onPageChange={setRAPage}
                            onPageSizeChange={setRAPageSize}
                            label="RA rows per page"
                        />
                    </div>

                    <footer className="flex flex-wrap items-center justify-between gap-4 border-t pt-4">
                        <p className="text-sm text-muted-foreground">
                            Formatting retained. Export follows filters.
                        </p>
                        <Button
                            disabled={processing || !filtered.length}
                            onClick={download}
                        >
                            <Download /> Export{' '}
                            {exportsAll ? 'all' : 'filtered'} rows (
                            {filtered.length.toLocaleString()})
                        </Button>
                    </footer>
                </section>
            )}
        </div>
    );
}
