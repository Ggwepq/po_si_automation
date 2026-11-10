import { FileCheck2, LayoutGrid, ListChecks } from 'lucide-react';
import { dashboard, poMatching, raMatching } from '@/routes';
import type { NavItem } from '@/types';

export type Workflow = NavItem & { description: string };

/** Workbook tools, listed once for the sidebar and the dashboard. */
export const workflows: Workflow[] = [
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

export const mainNavItems: NavItem[] = [
    { title: 'Dashboard', href: dashboard(), icon: LayoutGrid },
    ...workflows,
];
