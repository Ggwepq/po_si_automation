import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** A KPI tile: label, big value, a small line under it. */
export function StatCard({
    label,
    value,
    hint,
    tone,
    children,
}: {
    label: string;
    value: string;
    hint?: ReactNode;
    tone?: 'good' | 'warning';
    children?: ReactNode;
}) {
    return (
        <div className="break-inside-avoid rounded-xl border bg-card p-4">
            <div className="text-sm text-muted-foreground">{label}</div>
            <div
                className={cn(
                    'mt-1 text-xl font-semibold tabular-nums',
                    tone === 'warning' && 'text-amber-700 dark:text-amber-400',
                    tone === 'good' && 'text-emerald-700 dark:text-emerald-400',
                )}
            >
                {value}
            </div>
            {children}
            {hint && (
                <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
            )}
        </div>
    );
}
