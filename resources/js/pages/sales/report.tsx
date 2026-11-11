import { Head } from '@inertiajs/react';
import { SalesReport } from '@/features/sales/components/sales-report';
import type {
    ReportFilters,
    ReportPeriod,
    ReportSelection,
    SalesReport as Report,
} from '@/features/sales/lib/types';
import { report as reportRoute } from '@/routes/sales';

type Props = {
    period: ReportPeriod;
    filters: ReportFilters;
    selected: ReportSelection;
    report: Report;
    generatedAt: string;
};

export default function SalesReportPage(props: Props) {
    return (
        <>
            <Head title={`Sales report · ${props.period.label}`} />
            <SalesReport {...props} />
        </>
    );
}

SalesReportPage.layout = {
    breadcrumbs: [{ title: 'Sales report', href: reportRoute() }],
};
