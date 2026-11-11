import { ChevronDown, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export type FilterOption = { value: string; label: string; hint?: string };

type Props = {
    label: string;
    /** Word used when several are picked, e.g. "stores" → "3 stores". */
    plural: string;
    options: FilterOption[];
    selected: string[];
    onChange: (values: string[]) => void;
};

/**
 * Dropdown with checkboxes and search. Choices are applied when the user
 * clicks Apply or closes the dropdown, so ticking several boxes reloads the
 * report once, not once per box. An empty selection means "all".
 */
export function MultiSelectFilter({
    label,
    plural,
    options,
    selected,
    onChange,
}: Props) {
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState<string[]>(selected);
    const [query, setQuery] = useState('');

    const visible = useMemo(() => {
        const needle = query.trim().toLowerCase();

        return options.filter(
            (o) =>
                !needle ||
                `${o.label} ${o.value} ${o.hint ?? ''}`
                    .toLowerCase()
                    .includes(needle),
        );
    }, [options, query]);

    const summary =
        selected.length === 0
            ? 'All'
            : selected.length === 1
              ? (options.find((o) => o.value === selected[0])?.label ??
                selected[0])
              : `${selected.length} ${plural}`;

    const apply = (values: string[]) => {
        const changed =
            values.length !== selected.length ||
            values.some((v) => !selected.includes(v));

        if (changed) {
            onChange(values);
        }
    };

    const toggle = (value: string) =>
        setDraft((current) =>
            current.includes(value)
                ? current.filter((v) => v !== value)
                : [...current, value],
        );

    return (
        <Popover
            open={open}
            onOpenChange={(next) => {
                if (next) {
                    setDraft(selected);
                    setQuery('');
                } else {
                    apply(draft);
                }

                setOpen(next);
            }}
        >
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                        'h-9 max-w-64 justify-between gap-2 font-normal',
                        selected.length > 0 && 'border-primary/60 bg-primary/5',
                    )}
                >
                    <span className="truncate">
                        <span className="text-muted-foreground">{label}:</span>{' '}
                        {summary}
                    </span>
                    <ChevronDown className="size-4 shrink-0 opacity-60" />
                </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72 p-0">
                {options.length > 8 && (
                    <div className="relative border-b p-2">
                        <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            autoFocus
                            aria-label={`Search ${plural}`}
                            placeholder={`Search ${plural}…`}
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            className="h-8 pl-8"
                        />
                    </div>
                )}
                <div className="flex items-center justify-between border-b px-3 py-1.5 text-xs">
                    <button
                        type="button"
                        className="text-primary hover:underline"
                        onClick={() => setDraft(visible.map((o) => o.value))}
                    >
                        Select {query ? 'shown' : 'all'}
                    </button>
                    <button
                        type="button"
                        className="text-muted-foreground hover:underline"
                        onClick={() => setDraft([])}
                    >
                        Clear
                    </button>
                </div>
                <ul
                    className="max-h-64 overflow-y-auto p-1"
                    role="listbox"
                    aria-multiselectable
                    aria-label={label}
                >
                    {visible.map((option) => (
                        <li key={option.value}>
                            <label className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent">
                                <Checkbox
                                    checked={draft.includes(option.value)}
                                    onCheckedChange={() => toggle(option.value)}
                                    aria-label={option.label}
                                />
                                <span className="min-w-0 flex-1 truncate">
                                    {option.label}
                                </span>
                                {option.hint && (
                                    <span className="shrink-0 text-xs text-muted-foreground">
                                        {option.hint}
                                    </span>
                                )}
                            </label>
                        </li>
                    ))}
                    {!visible.length && (
                        <li className="px-2 py-6 text-center text-sm text-muted-foreground">
                            No matches.
                        </li>
                    )}
                </ul>
                <div className="flex items-center justify-between gap-2 border-t p-2">
                    <span className="text-xs text-muted-foreground">
                        {draft.length === 0
                            ? `All ${plural}`
                            : `${draft.length} selected`}
                    </span>
                    <Button
                        size="sm"
                        onClick={() => {
                            apply(draft);
                            setOpen(false);
                        }}
                    >
                        Apply
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    );
}
