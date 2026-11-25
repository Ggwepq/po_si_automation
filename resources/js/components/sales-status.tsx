import { Link, usePage } from '@inertiajs/react';
import { importMethod as importRoute } from '@/routes/sales';
import { cn } from '@/lib/utils';

/** Whole days from one YYYY-MM-DD to today. */
export function daysSince(date: string, today = new Date()): number {
    const [y, m, d] = date.split('-').map(Number);
    const start = Date.UTC(y, m - 1, d);
    const now = Date.UTC(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
    );

    return Math.round((now - start) / 86_400_000);
}

/**
 * "Last DSR: Nov 24" in the sidebar, green while the DSRs are up to date
 * (yesterday's sales are the newest the portal has), amber when behind.
 */
export function SalesStatus() {
    const sales = usePage().props.sales;

    if (!sales) {
        return null;
    }

    const last = sales.lastDsrDate;
    const behind = last === null ? null : daysSince(last);
    const current = behind !== null && behind <= 2;

    return (
        <Link
            href={importRoute()}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-sidebar-foreground/70 group-data-[collapsible=icon]:hidden hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            title={current ? 'DSRs are up to date' : 'Import the latest DSR'}
        >
            <span
                className={cn(
                    'size-2 shrink-0 rounded-full',
                    current ? 'bg-emerald-500' : 'bg-amber-500',
                )}
                aria-hidden
            />
            {last === null
                ? 'No DSR imported yet'
                : `Last DSR: ${new Date(`${last}T00:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: behind !== null && behind > 300 ? 'numeric' : undefined })}${current ? '' : ` · ${behind} days ago`}`}
        </Link>
    );
}
