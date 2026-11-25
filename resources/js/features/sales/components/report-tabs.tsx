import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type ReportTab = {
    key: string;
    label: string;
    /** A small dot after the label, e.g. when the data check found issues. */
    alert?: boolean;
    content: ReactNode;
};

/**
 * Tabs for the report's sections. Every panel stays in the page and prints,
 * so a printout or the browser's search still covers the whole report.
 */
export function ReportTabs({ tabs }: { tabs: ReportTab[] }) {
    const [active, setActive] = useState(tabs[0]?.key);
    const id = useId();

    const move = (from: number, step: number) => {
        const next = tabs[(from + step + tabs.length) % tabs.length];
        setActive(next.key);
        document.getElementById(`${id}-tab-${next.key}`)?.focus();
    };

    return (
        <div className="grid gap-4">
            <div
                role="tablist"
                aria-label="Report sections"
                className="flex gap-1 overflow-x-auto border-b print:hidden"
            >
                {tabs.map((tab, index) => {
                    const selected = tab.key === active;

                    return (
                        <button
                            key={tab.key}
                            id={`${id}-tab-${tab.key}`}
                            type="button"
                            role="tab"
                            aria-selected={selected}
                            aria-controls={`${id}-panel-${tab.key}`}
                            tabIndex={selected ? 0 : -1}
                            onClick={() => setActive(tab.key)}
                            onKeyDown={(e) => {
                                if (e.key === 'ArrowRight') {
                                    move(index, 1);
                                } else if (e.key === 'ArrowLeft') {
                                    move(index, -1);
                                }
                            }}
                            className={cn(
                                '-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm whitespace-nowrap transition-colors',
                                selected
                                    ? 'border-primary font-medium text-foreground'
                                    : 'border-transparent text-muted-foreground hover:text-foreground',
                            )}
                        >
                            {tab.label}
                            {tab.alert && (
                                <span
                                    className="size-1.5 rounded-full bg-amber-500"
                                    aria-label="needs attention"
                                />
                            )}
                        </button>
                    );
                })}
            </div>
            {tabs.map((tab) => (
                <div
                    key={tab.key}
                    id={`${id}-panel-${tab.key}`}
                    role="tabpanel"
                    aria-labelledby={`${id}-tab-${tab.key}`}
                    className={cn(
                        'grid grid-cols-1 gap-6',
                        tab.key !== active && 'hidden print:grid',
                    )}
                >
                    {tab.content}
                </div>
            ))}
        </div>
    );
}
