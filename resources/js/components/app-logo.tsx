import { usePage } from '@inertiajs/react';
import { BrandMark, COMPANY_NAME } from '@/components/brand-logo';

export default function AppLogo() {
    const { name } = usePage().props;

    return (
        <>
            <div className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-md bg-white shadow-sm">
                <BrandMark />
            </div>
            <div className="ml-1 grid flex-1 text-left text-sm">
                <span className="truncate leading-tight font-semibold">
                    {name}
                </span>
                <span className="truncate text-xs text-sidebar-foreground/70">
                    {COMPANY_NAME}
                </span>
            </div>
        </>
    );
}
