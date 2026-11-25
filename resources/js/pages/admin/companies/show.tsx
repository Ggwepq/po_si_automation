import { Head } from '@inertiajs/react';
import { CompanyLogo } from '@/components/brand-logo';
import { CompanyUsers } from '@/features/admin/components/company-users';
import type { CompanyUserRow, Paginated } from '@/features/admin/types';
import { index } from '@/routes/admin/companies';
import type { CompanyBrand } from '@/types';

type Props = {
    company: CompanyBrand;
    users: Paginated<CompanyUserRow>;
};

export default function CompanyPage({ company, users }: Props) {
    return (
        <>
            <Head title={company.name} />
            <div className="grid grid-cols-1 gap-6 p-4">
                <header className="flex items-center gap-4">
                    <CompanyLogo company={company} className="h-12" />
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight">
                            {company.name}
                        </h1>
                        {company.accountNumber && (
                            <p className="text-sm text-muted-foreground">
                                Account no. {company.accountNumber}
                            </p>
                        )}
                    </div>
                </header>
                <CompanyUsers company={company} users={users} />
            </div>
        </>
    );
}

CompanyPage.layout = {
    breadcrumbs: [{ title: 'Companies', href: index() }],
};
