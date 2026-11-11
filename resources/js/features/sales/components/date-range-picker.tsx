import {
    CalendarDays,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import type { DateRange } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { fromISO, presets, toISO } from '../lib/report-query';
import type { PeriodType, ReportPeriod } from '../lib/types';

const VIEWS: { value: PeriodType; label: string }[] = [
    { value: 'daily', label: 'Day' },
    { value: 'weekly', label: 'Week' },
    { value: 'monthly', label: 'Month' },
    { value: 'quarterly', label: 'Quarter' },
    { value: 'yearly', label: 'Year' },
    { value: 'custom', label: 'Range' },
];

export type PeriodChange = { period: PeriodType; date: string; end?: string };

type Props = {
    period: ReportPeriod;
    salesDates: string[];
    onChange: (change: PeriodChange) => void;
};

/**
 * One control for "which dates": quick presets, a calendar that marks days
 * with imported sales, and arrows to step to the previous/next period.
 */
export function DateRangePicker({ period, salesDates, onChange }: Props) {
    const [open, setOpen] = useState(false);
    const [view, setView] = useState<PeriodType>(period.type);
    const [range, setRange] = useState<DateRange | undefined>();

    const today = toISO(new Date());
    const latest = salesDates.at(-1) ?? null;
    const choices = useMemo(() => presets(today, latest), [today, latest]);
    const hasSales = useMemo(() => salesDates.map(fromISO), [salesDates]);
    const viewLabel = VIEWS.find((v) => v.value === period.type)?.label;

    const pick = (change: PeriodChange) => {
        onChange(change);
        setOpen(false);
    };

    return (
        <div className="flex items-center gap-1">
            <Button
                variant="outline"
                size="icon"
                className="size-9"
                aria-label={`Previous: ${period.previous.label}`}
                onClick={() =>
                    onChange({
                        period: period.type,
                        date: period.previous.start,
                        end: period.previous.end,
                    })
                }
            >
                <ChevronLeft />
            </Button>

            <Popover
                open={open}
                onOpenChange={(next) => {
                    if (next) {
                        setView(period.type);
                        setRange(
                            period.type === 'custom'
                                ? {
                                      from: fromISO(period.start),
                                      to: fromISO(period.end),
                                  }
                                : undefined,
                        );
                    }

                    setOpen(next);
                }}
            >
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        className="h-9 min-w-56 justify-between gap-2 font-normal"
                    >
                        <span className="flex items-center gap-2 truncate">
                            <CalendarDays className="size-4 text-muted-foreground" />
                            <span className="truncate font-medium">
                                {period.label}
                            </span>
                            <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                                {viewLabel}
                            </span>
                        </span>
                        <ChevronDown className="size-4 opacity-60" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-auto p-0">
                    <div className="flex flex-col sm:flex-row">
                        <ul
                            className="grid grid-cols-2 gap-0.5 border-b p-2 sm:w-44 sm:grid-cols-1 sm:border-r sm:border-b-0"
                            aria-label="Quick ranges"
                        >
                            {choices.map((choice) => {
                                const active =
                                    choice.period === period.type &&
                                    choice.start === period.start &&
                                    choice.end === period.end;

                                return (
                                    <li key={choice.id}>
                                        <button
                                            type="button"
                                            className={cn(
                                                'w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent',
                                                active &&
                                                    'bg-accent font-medium text-accent-foreground',
                                            )}
                                            onClick={() =>
                                                pick({
                                                    period: choice.period,
                                                    date: choice.start,
                                                    end: choice.end,
                                                })
                                            }
                                        >
                                            {choice.label}
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>

                        <div className="grid gap-3 p-3">
                            <div
                                className="flex flex-wrap gap-1"
                                role="tablist"
                                aria-label="View by"
                            >
                                {VIEWS.map(({ value, label }) => (
                                    <button
                                        key={value}
                                        type="button"
                                        role="tab"
                                        aria-selected={view === value}
                                        className={cn(
                                            'rounded-md px-2.5 py-1 text-xs font-medium hover:bg-accent',
                                            view === value
                                                ? 'bg-primary text-primary-foreground hover:bg-primary'
                                                : 'text-muted-foreground',
                                        )}
                                        onClick={() => {
                                            setView(value);

                                            if (value !== 'custom') {
                                                pick({
                                                    period: value,
                                                    date: period.start,
                                                });
                                            }
                                        }}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>

                            {view === 'custom' ? (
                                <>
                                    <Calendar
                                        mode="range"
                                        selected={range}
                                        onSelect={setRange}
                                        defaultMonth={
                                            range?.from ?? fromISO(period.start)
                                        }
                                        numberOfMonths={2}
                                        modifiers={{ hasSales }}
                                        modifiersClassNames={{
                                            hasSales: 'has-sales',
                                        }}
                                    />
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="text-xs text-muted-foreground">
                                            {range?.from && range.to
                                                ? `${toISO(range.from)} to ${toISO(range.to)}`
                                                : 'Pick a start and end day'}
                                        </span>
                                        <Button
                                            size="sm"
                                            disabled={!range?.from || !range.to}
                                            onClick={() =>
                                                range?.from &&
                                                range.to &&
                                                pick({
                                                    period: 'custom',
                                                    date: toISO(range.from),
                                                    end: toISO(range.to),
                                                })
                                            }
                                        >
                                            Apply range
                                        </Button>
                                    </div>
                                </>
                            ) : (
                                <Calendar
                                    mode="single"
                                    selected={fromISO(period.start)}
                                    onSelect={(day) =>
                                        day &&
                                        pick({ period: view, date: toISO(day) })
                                    }
                                    defaultMonth={fromISO(period.end)}
                                    modifiers={{
                                        hasSales,
                                        inPeriod: {
                                            from: fromISO(period.start),
                                            to: fromISO(period.end),
                                        },
                                    }}
                                    modifiersClassNames={{
                                        hasSales: 'has-sales',
                                        inPeriod:
                                            'bg-accent/60 first:rounded-l-md last:rounded-r-md',
                                    }}
                                />
                            )}

                            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <span className="size-1.5 rounded-full bg-primary" />{' '}
                                Days with imported sales
                                {latest && ` · latest ${latest}`}
                            </p>
                        </div>
                    </div>
                </PopoverContent>
            </Popover>

            <Button
                variant="outline"
                size="icon"
                className="size-9"
                aria-label={`Next: ${period.next.label}`}
                onClick={() =>
                    onChange({
                        period: period.type,
                        date: period.next.start,
                        end: period.next.end,
                    })
                }
            >
                <ChevronRight />
            </Button>
        </div>
    );
}
