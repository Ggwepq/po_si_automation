import { BrandLogo } from '@/components/brand-logo';

/**
 * Sidebar brand: the Park Solutions Inc. logo with "Sales Management System"
 * beside it, collapsing to just the logo when the sidebar is in icon mode.
 */
export default function AppLogo() {
    return (
        <div className="flex items-center gap-2.5 px-1.5 py-1 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
            <BrandLogo className="h-9 w-auto shrink-0 group-data-[collapsible=icon]:h-5" />
            <span className="text-left text-sm leading-tight font-semibold text-sidebar-foreground group-data-[collapsible=icon]:hidden">
                Sales Management System
            </span>
        </div>
    );
}
