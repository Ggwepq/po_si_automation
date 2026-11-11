import { Link } from '@inertiajs/react';
import { BrandLogo } from '@/components/brand-logo';
import { home } from '@/routes';
import type { AuthLayoutProps } from '@/types';

export default function AuthSimpleLayout({
    children,
    title,
    description,
}: AuthLayoutProps) {
    return (
        <div className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden bg-brand-blue p-6 md:p-10">
            {/* Brand yellow accent stripe, echoing the logo. */}
            <div
                aria-hidden
                className="absolute inset-x-0 bottom-0 h-2 bg-brand-yellow"
            />
            <div className="w-full max-w-sm rounded-2xl bg-card p-8 text-card-foreground shadow-xl">
                <div className="flex flex-col gap-8">
                    <div className="flex flex-col items-center gap-4">
                        <Link href={home()} className="rounded-lg">
                            <BrandLogo />
                            <span className="sr-only">{title}</span>
                        </Link>

                        <div className="space-y-2 text-center">
                            <h1 className="text-xl font-semibold">{title}</h1>
                            <p className="text-center text-sm text-muted-foreground">
                                {description}
                            </p>
                        </div>
                    </div>
                    {children}
                </div>
            </div>
            <p className="mt-6 text-xs text-white/70">
                Sales Management System
            </p>
        </div>
    );
}
