import { Head } from '@inertiajs/react';
import { RAWorkspace } from '@/features/ra-matching/components/ra-workspace';
import { raMatching } from '@/routes';

export default function RAMatchingPage() {
    return (
        <>
            <Head title="RA item matching" />
            <RAWorkspace />
        </>
    );
}

RAMatchingPage.layout = {
    breadcrumbs: [{ title: 'RA item matching', href: raMatching() }],
};
