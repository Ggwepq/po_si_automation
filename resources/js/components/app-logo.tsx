import { usePage } from '@inertiajs/react';
import { CompanyLogo, GroupMark } from '@/components/brand-logo';

/**
 * Sidebar brand: the user's company logo and name, or the Oroza Group mark
 * for super admins. Collapses to just the logo in icon mode.
 */
export default function AppLogo() {
    const { company } = usePage().props.auth;

    return (
        <div className="flex items-center gap-2.5 px-1.5 py-1 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
            {company ? (
                <CompanyLogo
                    company={company}
                    className="max-w-24 shrink-0 group-data-[collapsible=icon]:h-5"
                />
            ) : (
                <GroupMark className="shrink-0 group-data-[collapsible=icon]:size-5" />
            )}
            <span className="grid text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate font-semibold text-sidebar-foreground">
                    {company?.name ?? 'Oroza Group'}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                    {company ? 'Sales Management System' : 'Super admin'}
                </span>
            </span>
        </div>
    );
}
