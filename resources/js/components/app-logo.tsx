import { BrandLogo, BrandMark } from '@/components/brand-logo';

/**
 * Sidebar logo: the full Park Solutions logo, or just the pin when the
 * sidebar is collapsed to icons. The white tile keeps the logo's blue
 * lettering readable in dark mode.
 */
export default function AppLogo() {
    return (
        <div className="flex items-center justify-center rounded-lg bg-white p-2 shadow-sm group-data-[collapsible=icon]:p-1">
            <BrandLogo className="h-14 w-auto group-data-[collapsible=icon]:hidden" />
            <BrandMark className="hidden size-6 group-data-[collapsible=icon]:block" />
        </div>
    );
}
