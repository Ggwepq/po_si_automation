import { Link } from '@inertiajs/react';
import { ChevronRight } from 'lucide-react';
import CompanyController from '@/actions/App/Http/Controllers/Admin/CompanyController';
import { CompanyLogo } from '@/components/brand-logo';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { CompanyRow, Paginated } from '../types';
import { PageLinks } from './page-links';

export function CompanyList({
    companies,
}: {
    companies: Paginated<CompanyRow>;
}) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Companies</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
                {companies.data.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        No companies yet. Add the first one.
                    </p>
                ) : (
                    <ul className="divide-y rounded-lg border">
                        {companies.data.map((company) => (
                            <li key={company.id}>
                                <Link
                                    href={CompanyController.show(company.slug)}
                                    className="flex items-center gap-3 p-3 hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                                >
                                    <CompanyLogo
                                        company={company}
                                        className="w-16 shrink-0"
                                    />
                                    <span className="grid flex-1">
                                        <span className="font-medium">
                                            {company.name}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            {company.userCount === 1
                                                ? '1 user'
                                                : `${company.userCount} users`}
                                        </span>
                                    </span>
                                    <ChevronRight className="size-4 text-muted-foreground" />
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
                <PageLinks page={companies} />
            </CardContent>
        </Card>
    );
}
