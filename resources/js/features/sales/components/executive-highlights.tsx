import {
    AlertTriangle,
    ArrowDownRight,
    ArrowUpRight,
    Lightbulb,
    Minus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Insight } from '../lib/insights';

const toneIcon = {
    positive: ArrowUpRight,
    negative: ArrowDownRight,
    neutral: Minus,
    warning: AlertTriangle,
};

const toneColor = {
    positive: 'text-emerald-600 dark:text-emerald-400',
    negative: 'text-rose-600 dark:text-rose-400',
    neutral: 'text-muted-foreground',
    warning: 'text-amber-600 dark:text-amber-400',
};

/** The report's key takeaways in plain language, for management. */
export function ExecutiveHighlights({ insights }: { insights: Insight[] }) {
    return (
        <section
            aria-label="Executive highlights"
            className="grid break-inside-avoid gap-3 rounded-xl border bg-card p-4"
        >
            <h2 className="flex items-center gap-2 text-base font-semibold">
                <Lightbulb className="size-4 text-primary" /> Executive
                highlights
            </h2>
            <ul className="grid gap-2 sm:grid-cols-2">
                {insights.map((insight) => {
                    const Icon = toneIcon[insight.tone];

                    return (
                        <li
                            key={insight.title}
                            className="flex gap-2.5 text-sm"
                        >
                            <Icon
                                className={cn(
                                    'mt-0.5 size-4 shrink-0',
                                    toneColor[insight.tone],
                                )}
                            />
                            <span>
                                <span className="font-medium">
                                    {insight.title}:{' '}
                                </span>
                                <span className="text-muted-foreground">
                                    {insight.text}
                                </span>
                            </span>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}
