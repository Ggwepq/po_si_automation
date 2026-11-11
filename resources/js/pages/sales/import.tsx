import { Head } from '@inertiajs/react';
import { DsrImport } from '@/features/sales/components/dsr-import';
import type { ImportRecord } from '@/features/sales/components/import-history';
import { importMethod as importRoute } from '@/routes/sales';

type Props = {
    imports: ImportRecord[];
    limits: { reportsPerBatch: number; linesPerReport: number };
};

export default function ImportDsrPage(props: Props) {
    return (
        <>
            <Head title="Import DSR" />
            <DsrImport {...props} />
        </>
    );
}

ImportDsrPage.layout = {
    breadcrumbs: [{ title: 'Import DSR', href: importRoute() }],
};
