import { Link } from '@inertiajs/react';
import { FileUp } from 'lucide-react';
import { useState } from 'react';
import { BrandLogo } from '@/components/brand-logo';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { importMethod as importRoute } from '@/routes/sales';
import { downloadReport } from '../lib/export-report';
import {
    describeScope,
    formatMoney,
    formatQty,
    topSlices,
} from '../lib/format';
import type {
    DsrCoverage,
    ReportFilters,
    ReportPeriod,
    ReportSelection,
    SalesReport as Report,
} from '../lib/types';
import { ChartCard, SalesTrend, SharePie, TopItemsBar } from './charts';
import { DataCompleteness } from './data-completeness';
import { ItemsTable } from './items-table';
import { ReportToolbar } from './report-toolbar';
import { SlowMovers, StoresTable } from './store-tables';
import { SummaryCards } from './summary-cards';

type Props = {
    period: ReportPeriod;
    filters: ReportFilters;
    selected: ReportSelection;
    report: Report;
    coverage: DsrCoverage;
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
    generatedAt,
}: Props) {
    const [measure, setMeasure] = useState<'qty' | 'sales'>('qty');
    const scope = describeScope(filters, selected);
    const hasSales = report.summary.totalSales !== 0 || report.items.length > 0;

    const topItems = [...report.items]
        .sort((a, b) => b[measure] - a[measure])
        .slice(0, 10)
        .map((item) => ({ name: item.description, value: item[measure] }));

    return (
        <div className="grid grid-cols-1 gap-6 p-4 md:p-6 print:p-0">
            <header className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1">
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                        Sales report
                    </p>
                    <h1 className="text-2xl font-semibold tracking-tight">
                        {period.label}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        {scope} · {period.start} to {period.end} · Sales excl.
                        VAT
                    </p>
                </div>
                <div className="hidden text-right text-xs text-muted-foreground print:block">
                    <BrandLogo className="ml-auto w-28" />
                    Generated {new Date(generatedAt).toLocaleString('en-PH')}
                </div>
            </header>

            <ReportToolbar
                period={period}
                filters={filters}
                selected={selected}
                onExport={() => downloadReport(report, period, scope)}
            />

            {!filters.dataTo ? (
                <div className="grid justify-items-center gap-3 rounded-xl border border-dashed p-10 text-center">
                    <p className="font-medium">No sales data yet</p>
                    <p className="max-w-md text-sm text-muted-foreground">
                        Import a Daily Sales Report exported from the SM Vendor
                        Portal to build this report.
                    </p>
                    <Button asChild>
                        <Link href={importRoute()}>
                            <FileUp /> Import DSR
                        </Link>
                    </Button>
                </div>
            ) : (
                <>
                    <SummaryCards
                        summary={report.summary}
                        previousLabel={period.previous.label}
                    />

                    <DataCompleteness coverage={coverage} />

                    {!hasSales && (
                        <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                            No sales were imported for this period. Imported
                            data covers {filters.dataFrom} to {filters.dataTo}.
                        </p>
                    )}

                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 print:grid-cols-2">
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
                        <ChartCard
                            title={
                                report.trend.grouping === 'month'
                                    ? 'Monthly sales'
                                    : 'Daily sales'
                            }
                        >
                            <SalesTrend points={report.trend.points} />
                        </ChartCard>
                    </div>

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
                                        value &&
                                        setMeasure(value as 'qty' | 'sales')
                                    }
                                >
                                    <ToggleGroupItem
                                        value="qty"
                                        className="px-3"
                                    >
                                        By quantity
                                    </ToggleGroupItem>
                                    <ToggleGroupItem
                                        value="sales"
                                        className="px-3"
                                    >
                                        By sales
                                    </ToggleGroupItem>
                                </ToggleGroup>
                            </div>
                            <TopItemsBar items={topItems} measure={measure} />
                        </div>
                    </Section>

                    <Section
                        title="All items sold"
                        description={`${report.items.length} items · ${formatQty(report.summary.totalQty)} units · ${formatMoney(report.summary.totalSales)}`}
                    >
                        <ItemsTable items={report.items} />
                    </Section>

                    <Section title="Sales by store">
                        <StoresTable stores={report.byStore} />
                    </Section>

                    {/* With few items, the slowest are already visible in the full list. */}
                    {report.items.length > 20 && (
                        <Section
                            title="Slow movers"
                            description="The 10 items with the lowest sales in the period."
                        >
                            <SlowMovers items={report.items} />
                        </Section>
                    )}
                </>
            )}
        </div>
    );
}
