import { BrandLogo, BrandMark } from '@/components/brand-logo';

/**
 * Sidebar logo: the full Park Solutions logo (transparent PNG), or just the
 * pin when the sidebar is collapsed to icons.
 */
export default function AppLogo() {
    return (
        <div className="flex items-center justify-center px-1 py-1">
            <BrandLogo className="h-14 w-auto group-data-[collapsible=icon]:hidden" />
            <BrandMark className="hidden size-7 group-data-[collapsible=icon]:block" />
        </div>
    );
}
