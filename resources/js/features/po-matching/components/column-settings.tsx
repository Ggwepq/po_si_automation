import { ChevronDown } from 'lucide-react';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import type { PoWorkbook } from '../lib/types';
import { changePoColumns } from '../store';
import type { PoKind } from '../store';

function Field({
    label,
    value,
    options,
    onChange,
}: {
    label: string;
    value: string;
    options: string[];
    onChange: (value: string) => void;
}) {
    return (
        <label className="grid gap-1.5 text-sm">
            <span className="text-muted-foreground">{label}</span>
            <Select value={value} onValueChange={onChange}>
                <SelectTrigger aria-label={label}>
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {options.map((option) => (
                        <SelectItem key={option} value={option}>
                            {option}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </label>
    );
}

/** Lets users pick another worksheet or PO column when auto-detection is wrong. */
export function ColumnSettings({ po, gr }: Record<PoKind, PoWorkbook>) {
    const workbooks: [PoKind, PoWorkbook, string][] = [
        ['po', po, 'PO details'],
        ['gr', gr, 'GR details'],
    ];

    return (
        <Collapsible className="rounded-xl border">
            <CollapsibleTrigger className="group flex w-full items-center justify-between p-4 text-sm font-medium">
                Workbook settings
                <ChevronDown className="size-4 transition-transform group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="grid gap-6 border-t p-4 sm:grid-cols-2">
                {workbooks.map(([kind, data, title]) => (
                    <div key={kind} className="grid gap-3">
                        <strong className="text-sm">{title}</strong>
                        <Field
                            label={`${title} worksheet`}
                            value={data.sheetName}
                            options={data.workbook.SheetNames}
                            onChange={(sheet) => changePoColumns(kind, sheet)}
                        />
                        <Field
                            label={`${title} PO number column`}
                            value={data.poColumn}
                            options={data.headers}
                            onChange={(column) =>
                                changePoColumns(kind, data.sheetName, column)
                            }
                        />
                    </div>
                ))}
            </CollapsibleContent>
        </Collapsible>
    );
}
