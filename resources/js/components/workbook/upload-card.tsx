import { CheckCircle2, FileSpreadsheet, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

type Props = {
    title: string;
    subtitle?: string;
    /** Loaded file summary, or null before upload. */
    loaded: { fileName: string; rowCount: number; rowLabel?: string } | null;
    busy: boolean;
    onSelect: (file: File) => void;
    compact?: boolean;
};

/** Click-or-drop .xlsx picker. Selecting again replaces the loaded file. */
export function UploadCard({
    title,
    subtitle,
    loaded,
    busy,
    onSelect,
    compact = false,
}: Props) {
    const input = useRef<HTMLInputElement>(null);
    const [dragging, setDragging] = useState(false);

    const select = (file: File | undefined) => {
        if (file && !busy) {
            onSelect(file);
        }
    };

    const Icon = loaded ? FileSpreadsheet : Upload;

    return (
        <div
            onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                select(event.dataTransfer.files[0]);
            }}
            className={cn(
                'rounded-xl border border-dashed transition-colors',
                dragging && 'border-primary bg-primary/5',
                loaded && !dragging && 'border-solid',
            )}
        >
            <input
                ref={input}
                type="file"
                accept=".xlsx"
                className="sr-only"
                aria-label={`Upload ${title}`}
                disabled={busy}
                onChange={(event) => {
                    select(event.target.files?.[0]);
                    event.target.value = '';
                }}
            />
            <button
                type="button"
                disabled={busy}
                onClick={() => input.current?.click()}
                className={cn(
                    'flex w-full items-center gap-4 rounded-xl text-left hover:bg-muted/50 disabled:cursor-wait',
                    compact ? 'p-3' : 'p-6',
                )}
            >
                <span
                    className={cn(
                        'flex shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground',
                        compact ? 'size-9' : 'size-12',
                    )}
                >
                    {busy ? (
                        <Spinner />
                    ) : (
                        <Icon className={compact ? 'size-4' : 'size-6'} />
                    )}
                </span>
                <span className="grid min-w-0 flex-1 gap-0.5">
                    <span className="truncate font-medium">
                        {busy
                            ? 'Reading workbook…'
                            : compact && loaded
                              ? loaded.fileName
                              : title}
                    </span>
                    {!compact && (
                        <>
                            {subtitle && (
                                <span className="text-sm text-muted-foreground">
                                    {subtitle}
                                </span>
                            )}
                            <span className="truncate text-sm">
                                {loaded
                                    ? loaded.fileName
                                    : 'Select file to upload'}
                            </span>
                            <span className="text-xs text-muted-foreground">
                                {loaded
                                    ? `${loaded.rowCount.toLocaleString()} ${loaded.rowLabel ?? 'rows'} · Click to replace`
                                    : 'or drag and drop · .xlsx'}
                            </span>
                        </>
                    )}
                </span>
                {compact && loaded && (
                    <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                )}
            </button>
        </div>
    );
}
