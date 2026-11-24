import { Link } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import type { Paginated } from '../types';

/** Previous / next links under a paginated admin list. */
export function PageLinks({ page }: { page: Paginated<unknown> }) {
    if (page.last_page <= 1) {
        return null;
    }

    return (
        <nav
            aria-label="Pages"
            className="flex items-center justify-between gap-3 text-sm text-muted-foreground"
        >
            <span>
                Page {page.current_page} of {page.last_page} · {page.total}{' '}
                total
            </span>
            <div className="flex gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    disabled={!page.prev_page_url}
                    asChild={!!page.prev_page_url}
                >
                    {page.prev_page_url ? (
                        <Link href={page.prev_page_url} preserveScroll>
                            Previous
                        </Link>
                    ) : (
                        'Previous'
                    )}
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    disabled={!page.next_page_url}
                    asChild={!!page.next_page_url}
                >
                    {page.next_page_url ? (
                        <Link href={page.next_page_url} preserveScroll>
                            Next
                        </Link>
                    ) : (
                        'Next'
                    )}
                </Button>
            </div>
        </nav>
    );
}
