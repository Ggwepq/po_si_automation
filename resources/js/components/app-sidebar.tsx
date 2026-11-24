import { Link, usePage } from '@inertiajs/react';
import AppLogo from '@/components/app-logo';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
} from '@/components/ui/sidebar';
import { adminNavItems, mainNavItems } from '@/features/workflows';
import { dashboard } from '@/routes';
import { index as adminCompanies } from '@/routes/admin/companies';

export function AppSidebar() {
    const { isSuperAdmin } = usePage().props.auth;

    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
                <Link
                    href={isSuperAdmin ? adminCompanies() : dashboard()}
                    prefetch
                    aria-label={
                        isSuperAdmin ? 'Go to companies' : 'Go to dashboard'
                    }
                    className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                >
                    <AppLogo />
                </Link>
            </SidebarHeader>

            <SidebarContent>
                <NavMain items={isSuperAdmin ? adminNavItems : mainNavItems} />
            </SidebarContent>

            <SidebarFooter>
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
