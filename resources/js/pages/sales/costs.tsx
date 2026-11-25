import { Head } from '@inertiajs/react';
import type { ComponentProps } from 'react';
import { ProductCosts } from '@/features/sales/components/product-costs';
import { costs as costsRoute } from '@/routes/sales';

type Props = ComponentProps<typeof ProductCosts>;

export default function ProductCostsPage(props: Props) {
    return (
        <>
            <Head title="Product costs" />
            <ProductCosts {...props} />
        </>
    );
}

ProductCostsPage.layout = {
    breadcrumbs: [{ title: 'Product costs', href: costsRoute() }],
};
