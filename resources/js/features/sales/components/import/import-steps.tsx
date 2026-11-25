import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ImportStep } from './use-sales-import';

const STEPS: { key: ImportStep; label: string }[] = [
    { key: 'choose', label: 'Choose file' },
    { key: 'review', label: 'Review' },
    { key: 'done', label: 'Done' },
];

/** "1 Choose file — 2 Review — 3 Done", the current step highlighted. */
export function ImportSteps({ step }: { step: ImportStep }) {
    const current = STEPS.findIndex((s) => s.key === step);

    return (
        <ol
            className="flex items-center gap-2 text-sm"
            aria-label="Import steps"
        >
            {STEPS.map((s, index) => (
                <li key={s.key} className="flex items-center gap-2">
                    {index > 0 && (
                        <span className="h-px w-6 bg-border" aria-hidden />
                    )}
                    <span
                        className={cn(
                            'flex size-6 items-center justify-center rounded-full border text-xs font-medium',
                            index < current &&
                                'border-primary bg-primary text-primary-foreground',
                            index === current && 'border-primary text-primary',
                            index > current && 'text-muted-foreground',
                        )}
                        aria-current={index === current ? 'step' : undefined}
                    >
                        {index < current ? (
                            <Check className="size-3.5" />
                        ) : (
                            index + 1
                        )}
                    </span>
                    <span
                        className={cn(
                            index === current
                                ? 'font-medium'
                                : 'text-muted-foreground',
                        )}
                    >
                        {s.label}
                    </span>
                </li>
            ))}
        </ol>
    );
}
