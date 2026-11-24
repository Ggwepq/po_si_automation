import {
    Building2,
    ChartPie,
    FileCheck2,
    FileUp,
    LayoutGrid,
    ListChecks,
    TrendingUp,
    Workflow,
} from 'lucide-react';
import { dashboard, poMatching, raMatching } from '@/routes';
import { index as adminCompanies } from '@/routes/admin/companies';
import {
    importMethod as salesImport,
    report as salesReport,
} from '@/routes/sales';
import type { NavEntry } from '@/types';

/** Super admins manage companies and accounts only. */
export const adminNavItems: NavEntry[] = [
    { title: 'Companies', href: adminCompanies(), icon: Building2 },
];

/** Company users: everything here shows their own company's data. */
export const mainNavItems: NavEntry[] = [
    { title: 'Dashboard', href: dashboard(), icon: LayoutGrid },
    {
        title: 'Sales',
        icon: TrendingUp,
        items: [
            { title: 'Sales report', href: salesReport(), icon: ChartPie },
            { title: 'Import DSR', href: salesImport(), icon: FileUp },
        ],
    },
    {
        title: 'Automate',
        icon: Workflow,
        items: [
            {
                title: 'PO & SI workflow',
                href: poMatching(),
                icon: FileCheck2,
            },
            {
                title: 'RA item matching',
                href: raMatching(),
                icon: ListChecks,
            },
        ],
    },
];
