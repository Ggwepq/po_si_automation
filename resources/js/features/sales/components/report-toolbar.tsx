import { router } from '@inertiajs/react';
import { ChevronLeft, ChevronRight, Download, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { report as reportRoute } from '@/routes/sales';
import type {
    PeriodType,
    ReportFilters,
    ReportPeriod,
    ReportSelection,
} from '../lib/types';

const PERIODS: { value: PeriodType; label: string }[] = [
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'quarterly', label: 'Quarterly' },
    { value: 'yearly', label: 'Yearly' },
    { value: 'custom', label: 'Custom' },
];

const ALL = '__all__';

type Props = {
    period: ReportPeriod;
    filters: ReportFilters;
    selected: ReportSelection;
    onExport: () => void;
};

export function ReportToolbar({ period, filters, selected, onExport }: Props) {
    const go = (changes: {
        period?: PeriodType;
        date?: string;
        end?: string | null;
        company?: string | null;
        site?: string | null;
    }) => {
        const type = changes.period ?? period.type;
        const query = {
            period: type,
            date: changes.date ?? period.start,
            end: type === 'custom' ? (changes.end ?? period.end) : undefined,
            company:
                (changes.company !== undefined
                    ? changes.company
                    : selected.company) ?? undefined,
            site:
                (changes.site !== undefined ? changes.site : selected.site) ??
                undefined,
        };

        router.get(
            reportRoute({ query }).url,
            {},
            { preserveScroll: true, preserveState: true },
        );
    };

    const sites = filters.sites.filter(
        (s) => !selected.company || s.company === selected.company,
    );

    return (
        <div className="grid min-w-0 gap-3 print:hidden">
            <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Scrolls sideways on narrow screens instead of widening the page. */}
                <div className="max-w-full overflow-x-auto">
                    <ToggleGroup
                        type="single"
                        variant="outline"
                        size="sm"
                        value={period.type}
                        aria-label="Report period"
                        onValueChange={(value) =>
                            value && go({ period: value as PeriodType })
                        }
                    >
                        {PERIODS.map(({ value, label }) => (
                            <ToggleGroupItem
                                key={value}
                                value={value}
                                className="px-3"
                            >
                                {label}
                            </ToggleGroupItem>
                        ))}
                    </ToggleGroup>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={onExport}>
                        <Download /> Excel
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.print()}
                    >
                        <Printer /> Print
                    </Button>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
                {period.type === 'custom' ? (
                    <div className="flex items-center gap-2">
                        <Input
                            type="date"
                            aria-label="From"
                            className="h-9 w-40"
                            value={period.start}
                            onChange={(e) =>
                                e.target.value && go({ date: e.target.value })
                            }
                        />
                        <span className="text-sm text-muted-foreground">
                            to
                        </span>
                        <Input
                            type="date"
                            aria-label="To"
                            className="h-9 w-40"
                            value={period.end}
                            onChange={(e) =>
                                e.target.value && go({ end: e.target.value })
                            }
                        />
                    </div>
                ) : (
                    <div className="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            aria-label={`Previous: ${period.previous.label}`}
                            onClick={() => go({ date: period.previous.start })}
                        >
                            <ChevronLeft />
                        </Button>
                        <span className="min-w-36 text-center text-sm font-medium">
                            {period.label}
                        </span>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            aria-label={`Next: ${period.next.label}`}
                            onClick={() => go({ date: period.next.start })}
                        >
                            <ChevronRight />
                        </Button>
                    </div>
                )}

                <Select
                    value={selected.company ?? ALL}
                    onValueChange={(value) =>
                        go({
                            company: value === ALL ? null : value,
                            site: null,
                        })
                    }
                >
                    <SelectTrigger aria-label="Company" className="h-9 w-40">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={ALL}>All companies</SelectItem>
                        {filters.companies.map((company) => (
                            <SelectItem key={company} value={company}>
                                {company}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select
                    value={selected.site ?? ALL}
                    onValueChange={(value) =>
                        go({ site: value === ALL ? null : value })
                    }
                >
                    <SelectTrigger aria-label="Store" className="h-9 w-56">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={ALL}>All stores</SelectItem>
                        {sites.map((site) => (
                            <SelectItem key={site.code} value={site.code}>
                                {site.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </div>
    );
}
