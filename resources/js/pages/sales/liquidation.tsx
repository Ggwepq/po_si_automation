import { Head } from '@inertiajs/react';
import type { ComponentProps } from 'react';
import { LiquidationReport } from '@/features/sales/components/liquidation/liquidation-report';
import { liquidation as liquidationRoute } from '@/routes/sales';

type Props = ComponentProps<typeof LiquidationReport>;

export default function LiquidationPage(props: Props) {
    return (
        <>
            <Head title="Liquidation" />
            <LiquidationReport {...props} />
        </>
    );
}

LiquidationPage.layout = {
    breadcrumbs: [{ title: 'Liquidation', href: liquidationRoute() }],
};
