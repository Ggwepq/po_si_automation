import { router } from '@inertiajs/react';
import { Download, FileText, Printer, RotateCcw } from 'lucide-react';
import { MultiSelectFilter } from '@/components/multi-select-filter';
import { Button } from '@/components/ui/button';
import { report as reportRoute } from '@/routes/sales';
import { reportUrl } from '../lib/report-query';
import type { ReportQuery } from '../lib/report-query';
import type {
    ReportFilters,
    ReportPeriod,
    ReportSelection,
} from '../lib/types';
import { DateRangePicker } from './date-range-picker';
import type { PeriodChange } from './date-range-picker';

type Props = {
    period: ReportPeriod;
    filters: ReportFilters;
    selected: ReportSelection;
    onExport: () => void;
    /** Opens the PDF report; with `print`, also opens the print dialog. */
    onPdf: (print: boolean) => void;
    pdfBusy: boolean;
};

/**
 * Report filters in one row, like the vendor portal: dates, vendor (shown
 * only when there is more than one), company and store. Every change updates
 * the URL, so a view can be bookmarked or shared.
 */
export function ReportToolbar({
    period,
    filters,
    selected,
    onExport,
    onPdf,
    pdfBusy,
}: Props) {
    const current: ReportQuery = {
        period: period.type,
        date: period.start,
        end: period.end,
        ...selected,
    };

    const go = (changes: Partial<ReportQuery>) =>
        router.get(
            reportUrl(reportRoute().url, { ...current, ...changes }),
            {},
            { preserveScroll: true, preserveState: true },
        );

    // Only stores of the chosen companies are offered.
    const siteOptions = filters.sites
        .filter(
            (s) =>
                selected.companies.length === 0 ||
                selected.companies.includes(s.company),
        )
        .map((s) => ({ value: s.code, label: s.name, hint: s.code }));

    const filtered =
        selected.vendors.length +
            selected.companies.length +
            selected.sites.length >
        0;

    return (
        <div className="flex flex-wrap items-center gap-2 print:hidden">
            <DateRangePicker
                period={period}
                salesDates={filters.salesDates}
                onChange={(change: PeriodChange) => go(change)}
            />

            {filters.vendors.length > 1 && (
                <MultiSelectFilter
                    label="Vendor"
                    plural="vendors"
                    options={filters.vendors.map((v) => ({
                        value: v.code,
                        label: v.name,
                        hint: v.code,
                    }))}
                    selected={selected.vendors}
                    onChange={(vendors) => go({ vendors })}
                />
            )}

            <MultiSelectFilter
                label="Company"
                plural="companies"
                options={filters.companies.map((c) => ({ value: c, label: c }))}
                selected={selected.companies}
                onChange={(companies) =>
                    go({
                        companies,
                        // Drop stores that no longer belong to the chosen companies.
                        sites: selected.sites.filter((code) =>
                            filters.sites.some(
                                (s) =>
                                    s.code === code &&
                                    (companies.length === 0 ||
                                        companies.includes(s.company)),
                            ),
                        ),
                    })
                }
            />

            <MultiSelectFilter
                label="Store"
                plural="stores"
                options={siteOptions}
                selected={selected.sites}
                onChange={(sites) => go({ sites })}
            />

            {filtered && (
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-9"
                    onClick={() =>
                        go({ vendors: [], companies: [], sites: [] })
                    }
                >
                    <RotateCcw /> Reset filters
                </Button>
            )}

            <div className="ml-auto flex flex-wrap gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    className="h-9"
                    onClick={onExport}
                >
                    <Download /> Excel
                </Button>
                <Button
                    size="sm"
                    className="h-9"
                    disabled={pdfBusy}
                    onClick={() => onPdf(false)}
                >
                    <FileText /> {pdfBusy ? 'Preparing…' : 'View PDF'}
                </Button>
                {/* Prints the PDF report, so every printout has the same layout. */}
                <Button
                    variant="outline"
                    size="sm"
                    className="h-9"
                    disabled={pdfBusy}
                    onClick={() => onPdf(true)}
                >
                    <Printer /> Print
                </Button>
            </div>
        </div>
    );
}
