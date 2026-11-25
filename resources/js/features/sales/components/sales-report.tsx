import { usePage } from '@inertiajs/react';
import { FileUp } from 'lucide-react';
import { useState } from 'react';
import { CompanyLogo } from '@/components/brand-logo';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
    matrix as matrixRoute,
    modcon as modconRoute,
} from '@/routes/sales/report';
import { toast } from 'sonner';
import {
    downloadModconReport,
    downloadReport,
    downloadStatusReport,
} from '../lib/export-report';
import { buildInsights } from '../lib/insights';
import { openReportPdf } from '../lib/open-report-pdf';
import { reportUrl } from '../lib/report-query';
import {
    describeScope,
    formatMoney,
    formatQty,
    topSlices,
} from '../lib/format';
import type {
    DsrCoverage,
    DsrReconciliation,
    ReportFilters,
    ReportPeriod,
    ReportSelection,
    SalesReport as Report,
} from '../lib/types';
import { ChartCard, SalesTrend, SharePie, TopItemsBar } from './charts';
import { DataCompleteness } from './data-completeness';
import { ReconciliationPanel } from './reconciliation-panel';
import { ExecutiveHighlights } from './executive-highlights';
import { ItemsTable } from './items-table';
import { ReportTabs } from './report-tabs';
import { ReportToolbar } from './report-toolbar';
import { SlowMovers, StoresTable } from './store-tables';
import { SummaryCards } from './summary-cards';

type Props = {
    period: ReportPeriod;
    filters: ReportFilters;
    selected: ReportSelection;
    report: Report;
    coverage: DsrCoverage;
    reconciliation: DsrReconciliation;
    generatedAt: string;
};

function Section({
    title,
    description,
    children,
}: {
    title: string;
    description?: string;
    children: React.ReactNode;
}) {
    return (
        <section className="grid break-inside-avoid grid-cols-1 gap-3">
            <div>
                <h2 className="text-base font-semibold">{title}</h2>
                {description && (
                    <p className="text-sm text-muted-foreground">
                        {description}
                    </p>
                )}
            </div>
            {children}
        </section>
    );
}

export function SalesReport({
    period,
    filters,
    selected,
    report,
    coverage,
    reconciliation,
    generatedAt,
}: Props) {
    const { company } = usePage().props.auth;
    const [measure, setMeasure] = useState<'qty' | 'sales'>('qty');
    const [pdfBusy, setPdfBusy] = useState(false);
    const [excelBusy, setExcelBusy] = useState(false);
    const [importOpen, setImportOpen] = useState(false);
    const scope = describeScope(filters, selected);
    const hasSales = report.summary.totalSales !== 0 || report.items.length > 0;
    const insights = buildInsights(report, {
        previousLabel: period.previous.label,
        money: formatMoney,
        qty: formatQty,
        coverage,
        reconciliation,
    });

    const openPdf = async (print: boolean) => {
        setPdfBusy(true);

        try {
            await openReportPdf(
                {
                    report,
                    period,
                    coverage,
                    reconciliation,
                    scope,
                    generatedAt,
                    companyName: company?.name ?? 'Sales Management System',
                    autoPrint: print,
                },
                company?.logoUrl ?? null,
                `Sales_Report_${period.start}_to_${period.end}.pdf`,
            );
        } catch {
            toast.error('The PDF could not be created. Please try again.');
        } finally {
            setPdfBusy(false);
        }
    };

    const query = {
        period: period.type,
        date: period.start,
        end: period.end,
        ...selected,
    };
    const companyName = company?.name ?? 'Sales';

    /** Runs an Excel download, showing progress and any failure. */
    const runExport = async (download: () => Promise<void>) => {
        setExcelBusy(true);

        try {
            await download();
        } catch {
            toast.error(
                'The Excel file could not be created. Please try again.',
            );
        } finally {
            setExcelBusy(false);
        }
    };

    const exportStatusReport = () =>
        runExport(() =>
            downloadStatusReport(companyName, period, {
                period: reportUrl(matrixRoute().url, query),
                year: reportUrl(matrixRoute().url, {
                    ...query,
                    period: 'yearly',
                    date: `${period.start.slice(0, 4)}-01-01`,
                    end: undefined,
                }),
            }),
        );

    const exportModcon = () =>
        runExport(() =>
            downloadModconReport(
                companyName,
                period,
                reportUrl(modconRoute().url, query),
            ),
        );

    const topItems = [...report.items]
        .sort((a, b) => b[measure] - a[measure])
        .slice(0, 10)
        .map((item) => ({ name: item.description, value: item[measure] }));

    const dataCheckAlert =
        !coverage.complete ||
        (reconciliation.checked && !reconciliation.balanced);

    const sharePies = (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 print:grid-cols-1">
            <ChartCard title="Sales share by store">
                <SharePie
                    slices={topSlices(
                        report.byStore,
                        (s) => s.name,
                        (s) => s.sales,
                    )}
                />
            </ChartCard>
            <ChartCard title="Sales share by company">
                <SharePie
                    slices={topSlices(
                        report.byCompany,
                        (c) => c.company,
                        (c) => c.sales,
                    )}
                />
            </ChartCard>
            <ChartCard title="Sales share by item">
                <SharePie
                    slices={topSlices(
                        report.items,
                        (i) => i.description,
                        (i) => i.sales,
                        5,
                    )}
                />
            </ChartCard>
        </div>
    );

    const topTen = (
        <Section
            title="Top 10 selling items"
            description="Best sellers in the period."
        >
            <div className="rounded-xl border bg-card p-4">
                <div className="mb-3 flex justify-end print:hidden">
                    <ToggleGroup
                        type="single"
                        variant="outline"
                        size="sm"
                        value={measure}
                        aria-label="Rank top items by"
                        onValueChange={(value) =>
                            value && setMeasure(value as 'qty' | 'sales')
                        }
                    >
                        <ToggleGroupItem value="qty" className="px-3">
                            By quantity
                        </ToggleGroupItem>
                        <ToggleGroupItem value="sales" className="px-3">
                            By sales
                        </ToggleGroupItem>
                    </ToggleGroup>
                </div>
                <TopItemsBar items={topItems} measure={measure} />
            </div>
        </Section>
    );

    return (
        <div className="grid grid-cols-1 gap-6 p-4 md:p-6 print:p-0">
            <header className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1">
                    <h1 className="text-2xl font-semibold tracking-tight">
                        {period.label}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        {scope} · {period.start} to {period.end} · Sales excl.
                        VAT
                    </p>
                </div>
                <div className="hidden text-right text-xs text-muted-foreground print:block">
                    {company && (
                        <CompanyLogo
                            company={company}
                            className="ml-auto h-10"
                        />
                    )}
                    Generated {new Date(generatedAt).toLocaleString('en-PH')}
                </div>
            </header>

            {/* Stays in view while scrolling, so the period can be changed anywhere. */}
            <div className="sticky top-0 z-20 -mx-4 border-b bg-background/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:-mx-6 md:px-6 print:hidden">
                <ReportToolbar
                    period={period}
                    filters={filters}
                    selected={selected}
                    onExport={exportStatusReport}
                    onExportModcon={exportModcon}
                    onExportData={() => downloadReport(report, period, scope)}
                    excelBusy={excelBusy}
                    onPdf={(print) => void openPdf(print)}
                    pdfBusy={pdfBusy}
                    importOpen={importOpen}
                    onImportOpenChange={setImportOpen}
                />
            </div>

            {!filters.dataTo ? (
                <div className="grid justify-items-center gap-3 rounded-xl border border-dashed p-10 text-center">
                    <FileUp className="size-8 text-muted-foreground" />
                    <p className="font-medium">Import your first DSR</p>
                    <p className="max-w-md text-sm text-muted-foreground">
                        Export a Daily Sales Report from the SM Vendor Portal
                        (Export Document) and import it. This page then shows
                        your sales by day, item and store.
                    </p>
                    <Button onClick={() => setImportOpen(true)}>
                        <FileUp /> Import DSR
                    </Button>
                </div>
            ) : (
                <>
                    <SummaryCards
                        summary={report.summary}
                        previousLabel={period.previous.label}
                    />

                    <ChartCard
                        title={
                            report.trend.grouping === 'month'
                                ? 'Monthly sales'
                                : 'Daily sales'
                        }
                    >
                        <SalesTrend points={report.trend.points} />
                    </ChartCard>

                    {!hasSales && (
                        <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                            No sales were imported for this period. Imported
                            data covers {filters.dataFrom} to {filters.dataTo}.
                        </p>
                    )}

                    <ReportTabs
                        tabs={[
                            {
                                key: 'overview',
                                label: 'Overview',
                                content: (
                                    <>
                                        <ExecutiveHighlights
                                            insights={insights}
                                        />
                                        {topTen}
                                        {sharePies}
                                    </>
                                ),
                            },
                            {
                                key: 'items',
                                label: `Items (${report.items.length})`,
                                content: (
                                    <>
                                        <Section
                                            title="All items sold"
                                            description={`${report.items.length} items · ${formatQty(report.summary.totalQty)} units · ${formatMoney(report.summary.totalSales)}`}
                                        >
                                            <ItemsTable items={report.items} />
                                        </Section>
                                        {/* With few items, the slowest are already visible in the full list. */}
                                        {report.items.length > 20 && (
                                            <Section
                                                title="Slow movers"
                                                description="The 10 items with the lowest sales in the period."
                                            >
                                                <SlowMovers
                                                    items={report.items}
                                                />
                                            </Section>
                                        )}
                                    </>
                                ),
                            },
                            {
                                key: 'stores',
                                label: `Stores (${report.byStore.length})`,
                                content: (
                                    <Section title="Sales by store">
                                        <StoresTable stores={report.byStore} />
                                    </Section>
                                ),
                            },
                            {
                                key: 'check',
                                label: 'Data check',
                                alert: dataCheckAlert,
                                content: (
                                    <>
                                        <DataCompleteness coverage={coverage} />
                                        <ReconciliationPanel
                                            reconciliation={reconciliation}
                                        />
                                    </>
                                ),
                            },
                        ]}
                    />
                </>
            )}
        </div>
    );
}
