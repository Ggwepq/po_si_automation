import { Link, usePage } from '@inertiajs/react';
import AppLogo from '@/components/app-logo';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { SalesStatus } from '@/components/sales-status';
import { adminNavSections, companyNavSections } from '@/features/workflows';
import { index as adminCompanies } from '@/routes/admin/companies';
import { report as salesReport } from '@/routes/sales';

export function AppSidebar() {
    const { isSuperAdmin, company } = usePage().props.auth;

    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link
                                href={
                                    isSuperAdmin
                                        ? adminCompanies()
                                        : salesReport()
                                }
                                prefetch
                            >
                                <AppLogo />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <NavMain
                    sections={
                        isSuperAdmin
                            ? adminNavSections
                            : companyNavSections(company)
                    }
                />
            </SidebarContent>

            <SidebarFooter>
                <SalesStatus />
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
