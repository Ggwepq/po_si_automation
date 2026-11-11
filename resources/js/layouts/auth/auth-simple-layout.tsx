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
        <div className="flex min-h-svh items-center justify-center bg-background p-6">
            <div className="w-full max-w-sm rounded-2xl border bg-card p-8 text-card-foreground shadow-sm">
                <div className="grid gap-6">
                    <div className="grid justify-items-center gap-3 text-center">
                        <Link href={home()} className="rounded-lg">
                            <BrandLogo className="w-40" />
                        </Link>
                        <h1 className="text-lg font-semibold">{title}</h1>
                        {description && (
                            <p className="text-sm text-muted-foreground">
                                {description}
                            </p>
                        )}
                    </div>
                    {children}
                </div>
            </div>
        </div>
    );
}
