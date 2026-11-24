import { Head } from '@inertiajs/react';
import { AddCompanyForm } from '@/features/admin/components/add-company-form';
import { CompanyList } from '@/features/admin/components/company-list';
import type { CompanyRow, Paginated } from '@/features/admin/types';
import { index } from '@/routes/admin/companies';

export default function CompaniesPage({
    companies,
}: {
    companies: Paginated<CompanyRow>;
}) {
    return (
        <>
            <Head title="Companies" />
            <div className="grid grid-cols-1 gap-6 p-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
                <CompanyList companies={companies} />
                <AddCompanyForm />
            </div>
        </>
    );
}

CompaniesPage.layout = {
    breadcrumbs: [{ title: 'Companies', href: index() }],
};
