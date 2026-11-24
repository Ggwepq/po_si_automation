import { cn } from '@/lib/utils';
import type { CompanyBrand } from '@/types';

export const GROUP_NAME = 'Oroza Group';

const GROUP_LOGO = {
    // Navy wordmark for light backgrounds, white wordmark for dark mode.
    onLight: '/assets/logo/orozagroup/orozagroup-logo-dark.png',
    onDark: '/assets/logo/orozagroup/orozagroup-logo-light.png',
    mark: '/assets/logo/orozagroup/orozagroup-mark.png',
};

/** Full Oroza Group logo, following the light or dark theme. */
export function GroupLogo({ className }: { className?: string }) {
    return (
        <>
            <img
                src={GROUP_LOGO.onLight}
                alt={GROUP_NAME}
                className={cn(
                    'h-auto w-44 object-contain dark:hidden',
                    className,
                )}
                draggable={false}
            />
            <img
                src={GROUP_LOGO.onDark}
                alt={GROUP_NAME}
                className={cn(
                    'hidden h-auto w-44 object-contain dark:block',
                    className,
                )}
                draggable={false}
            />
        </>
    );
}

/** Oroza Group monogram for tight spaces such as the admin sidebar. */
export function GroupMark({ className }: { className?: string }) {
    return (
        <img
            src={GROUP_LOGO.mark}
            alt={GROUP_NAME}
            className={cn('size-8 object-contain', className)}
            draggable={false}
        />
    );
}

/** A company's own logo, or its initials when it has none. */
export function CompanyLogo({
    company,
    className,
}: {
    company: CompanyBrand;
    className?: string;
}) {
    if (company.logoUrl) {
        return (
            <img
                src={company.logoUrl}
                alt={company.name}
                className={cn('h-9 w-auto object-contain', className)}
                draggable={false}
            />
        );
    }

    return (
        <span
            aria-label={company.name}
            className={cn(
                'flex size-9 items-center justify-center rounded-md bg-primary text-xs font-semibold text-primary-foreground',
                className,
            )}
        >
            {company.name
                .split(/\s+/)
                .map((word) => word[0])
                .join('')
                .slice(0, 3)
                .toUpperCase()}
        </span>
    );
}
