import {
    Building2,
    ChartPie,
    Coins,
    FileCheck2,
    FileUp,
    HandCoins,
    ListChecks,
} from 'lucide-react';
import { poMatching, raMatching } from '@/routes';
import { index as adminCompanies } from '@/routes/admin/companies';
import {
    costs as salesCosts,
    importMethod as salesImport,
    liquidation as salesLiquidation,
    report as salesReport,
} from '@/routes/sales';
import type { CompanyBrand, NavSection } from '@/types';

/** Super admins manage companies and accounts only. */
export const adminNavSections: NavSection[] = [
    {
        label: 'Administration',
        items: [
            { title: 'Companies', href: adminCompanies(), icon: Building2 },
        ],
    },
];

/** Company users: everything here shows their own company's data. */
export function companyNavSections(company: CompanyBrand | null): NavSection[] {
    const sales: NavSection = {
        label: 'Sales',
        items: [
            { title: 'Overview', href: salesReport(), icon: ChartPie },
            { title: 'Liquidation', href: salesLiquidation(), icon: HandCoins },
            { title: 'Import', href: salesImport(), icon: FileUp },
            { title: 'Product costs', href: salesCosts(), icon: Coins },
        ],
    };

    // PO & SI workflow and RA item matching: Oroza Enterprise only.
    const tools: NavSection = {
        label: 'Tools',
        items: [
            { title: 'PO & SI workflow', href: poMatching(), icon: FileCheck2 },
            { title: 'RA item matching', href: raMatching(), icon: ListChecks },
        ],
    };

    return company?.workbookTools ? [sales, tools] : [sales];
}
