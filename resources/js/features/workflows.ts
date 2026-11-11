import {
    ChartPie,
    FileCheck2,
    FileUp,
    LayoutGrid,
    ListChecks,
    TrendingUp,
    Workflow,
} from 'lucide-react';
import { dashboard, poMatching, raMatching } from '@/routes';
import {
    importMethod as salesImport,
    report as salesReport,
} from '@/routes/sales';
import type { NavEntry, NavItem } from '@/types';

export type AutomationTool = NavItem & { description: string };

/** Workbook tools, listed once for the sidebar and the dashboard. */
export const workflows: AutomationTool[] = [
    {
        title: 'PO & SI workflow',
        href: poMatching(),
        icon: FileCheck2,
        description:
            'Compare purchase orders with goods receipts and review delivery remarks.',
    },
    {
        title: 'RA item matching',
        href: raMatching(),
        icon: ListChecks,
        description:
            'Match document references to ICR sales invoices and fill the ITEM column.',
    },
];

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
    { title: 'Automate', icon: Workflow, items: workflows },
];
