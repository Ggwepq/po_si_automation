import { usePage } from '@inertiajs/react';
import { CompanyLogo, GroupMark } from '@/components/brand-logo';

/** Sidebar brand: the user's company, or Oroza Group for super admins. */
export default function AppLogo() {
    const { company } = usePage().props.auth;

    return (
        <>
            {company ? (
                <CompanyLogo
                    company={company}
                    className="h-8 max-w-20 min-w-8 shrink-0"
                />
            ) : (
                <div className="flex aspect-square size-8 items-center justify-center rounded-md">
                    <GroupMark className="size-8" />
                </div>
            )}
            <div className="ml-1 grid flex-1 text-left text-sm">
                <span className="truncate leading-tight font-semibold">
                    {company?.name ?? 'Oroza Group'}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                    {company
                        ? company.accountNumber
                            ? `SM vendor ${company.accountNumber}`
                            : 'Sales'
                        : 'Administration'}
                </span>
            </div>
        </>
    );
}
