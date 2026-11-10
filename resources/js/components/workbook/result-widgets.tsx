import { Search, ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';

export type Tone = 'positive' | 'warning' | 'attention' | 'neutral';

const toneDot: Record<Tone, string> = {
    positive: 'bg-emerald-500',
    warning: 'bg-amber-500',
    attention: 'bg-rose-500',
    neutral: 'bg-muted-foreground',
};

const toneBadge: Record<Tone, string> = {
    positive:
        'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
    warning:
        'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
    attention:
        'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400',
    neutral: 'bg-muted text-muted-foreground',
};

export function StatusBadge({
    tone,
    children,
}: {
    tone: Tone;
    children: ReactNode;
}) {
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium',
                toneBadge[tone],
            )}
        >
            <span className={cn('size-1.5 rounded-full', toneDot[tone])} />
            {children}
        </span>
    );
}

export function StatCard({
    label,
    value,
    hint,
    tone,
}: {
    label: string;
    value: number;
    hint: string;
    tone?: Tone;
}) {
    return (
        <div className="rounded-xl border p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {tone && (
                    <span
                        className={cn('size-2 rounded-full', toneDot[tone])}
                    />
                )}
                {label}
            </div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">
                {value.toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground">{hint}</div>
        </div>
    );
}

export function ResultsToolbar<F extends string>({
    filters,
    filter,
    onFilterChange,
    query,
    onQueryChange,
    filterLabel,
    searchLabel,
    searchPlaceholder,
}: {
    filters: readonly F[];
    filter: F;
    onFilterChange: (filter: F) => void;
    query: string;
    onQueryChange: (query: string) => void;
    filterLabel: string;
    searchLabel: string;
    searchPlaceholder: string;
}) {
    return (
        <div className="flex flex-wrap items-center justify-between gap-3">
            <ToggleGroup
                type="single"
                variant="outline"
                size="sm"
                value={filter}
                aria-label={filterLabel}
                onValueChange={(value) => value && onFilterChange(value as F)}
            >
                {filters.map((option) => (
                    <ToggleGroupItem
                        key={option}
                        value={option}
                        className="px-3"
                    >
                        {option}
                    </ToggleGroupItem>
                ))}
            </ToggleGroup>
            <label className="relative w-full sm:w-72">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                    aria-label={searchLabel}
                    placeholder={searchPlaceholder}
                    value={query}
                    onChange={(event) => onQueryChange(event.target.value)}
                    className="pl-8"
                />
            </label>
        </div>
    );
}

export function LocalProcessingTag() {
    return (
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5" />
            Processed locally on this device
        </span>
    );
}

export function SectionHeading({
    eyebrow,
    title,
    description,
    action,
}: {
    eyebrow?: string;
    title: string;
    description?: ReactNode;
    action?: ReactNode;
}) {
    return (
        <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="space-y-0.5">
                {eyebrow && (
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                        {eyebrow}
                    </p>
                )}
                <h2 className="text-lg font-semibold tracking-tight">
                    {title}
                </h2>
                {description && (
                    <p className="text-sm text-muted-foreground">
                        {description}
                    </p>
                )}
            </div>
            {action}
        </div>
    );
}
