import { Head } from '@inertiajs/react';
import { DsrImport } from '@/features/sales/components/dsr-import';
import type { ComponentProps } from 'react';
import { importMethod as importRoute } from '@/routes/sales';

type Props = ComponentProps<typeof DsrImport>;

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
