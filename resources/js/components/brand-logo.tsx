import { cn } from '@/lib/utils';

export const COMPANY_NAME = 'Park Solutions Inc.';

/** Full Park Solutions logo (pin + wordmark). */
export function BrandLogo({ className }: { className?: string }) {
    return (
        <img
            src="/images/park-solutions-logo.png"
            alt={COMPANY_NAME}
            className={cn('h-auto w-44 object-contain', className)}
            draggable={false}
        />
    );
}

/** Pin-only mark for tight spaces such as the collapsed sidebar. */
export function BrandMark({ className }: { className?: string }) {
    return (
        <img
            src="/favicon.png"
            alt=""
            aria-hidden
            className={cn('size-6 object-contain', className)}
            draggable={false}
        />
    );
}
