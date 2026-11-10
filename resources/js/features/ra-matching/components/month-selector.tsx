import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { SectionHeading } from '@/components/workbook/result-widgets';
import { cn } from '@/lib/utils';
import type { ICRWorkbook } from '../lib/types';
import { toggleAllMonths, toggleMonth } from '../store';

export function MonthSelector({
    icr,
    months,
    disabled,
}: {
    icr: ICRWorkbook;
    months: string[];
    disabled: boolean;
}) {
    const allSelected = months.length === icr.sheets.length;

    return (
        <section className="grid gap-4">
            <SectionHeading
                eyebrow="02 · Select ICR months"
                title="Months"
                description="Selected months first, then the rest of ICR."
                action={
                    <Button
                        variant="ghost"
                        size="sm"
                        disabled={disabled}
                        onClick={toggleAllMonths}
                    >
                        {allSelected ? 'Clear selection' : 'Select all'}
                    </Button>
                }
            />
            <div className="flex flex-wrap gap-2">
                {icr.sheets.map(({ sheetName }) => {
                    const checked = months.includes(sheetName);

                    return (
                        <label
                            key={sheetName}
                            className={cn(
                                'flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm',
                                checked && 'border-primary bg-primary/5',
                            )}
                        >
                            <Checkbox
                                aria-label={sheetName}
                                checked={checked}
                                disabled={disabled}
                                onCheckedChange={() => toggleMonth(sheetName)}
                            />
                            {sheetName}
                        </label>
                    );
                })}
            </div>
            {!months.length && (
                <p className="text-sm text-muted-foreground" role="status">
                    Select a month to continue.
                </p>
            )}
            {icr.skippedSheets.length > 0 && (
                <Collapsible className="rounded-xl border text-sm">
                    <CollapsibleTrigger className="group flex w-full items-center justify-between p-3">
                        {icr.skippedSheets.length} skipped sheet(s)
                        <ChevronDown className="size-4 transition-transform group-data-[state=open]:rotate-180" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="border-t p-3">
                        <ul className="list-inside list-disc space-y-1 text-muted-foreground">
                            {icr.skippedSheets.map((sheet) => (
                                <li key={sheet.name}>{sheet.reason}</li>
                            ))}
                        </ul>
                    </CollapsibleContent>
                </Collapsible>
            )}
        </section>
    );
}
