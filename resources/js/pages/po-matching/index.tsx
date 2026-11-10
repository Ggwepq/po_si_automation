import { Head } from '@inertiajs/react';
import { PoWorkspace } from '@/features/po-matching/components/po-workspace';
import { poMatching } from '@/routes';

export default function PoMatchingPage() {
    return (
        <>
            <Head title="PO & SI workflow" />
            <PoWorkspace />
        </>
    );
}

PoMatchingPage.layout = {
    breadcrumbs: [{ title: 'PO & SI workflow', href: poMatching() }],
};
