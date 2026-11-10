import { Head, Link } from '@inertiajs/react';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { workflows } from '@/features/workflows';
import { dashboard } from '@/routes';

export default function Dashboard() {
    return (
        <>
            <Head title="Dashboard" />
            <div className="grid gap-8 p-4 md:p-6">
                <header className="space-y-1">
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                        Workbook automation
                    </p>
                    <h1 className="text-2xl font-semibold tracking-tight">
                        What would you like to automate?
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Choose a workflow to get started.
                    </p>
                </header>

                <div className="grid gap-4 md:grid-cols-2">
                    {workflows.map((workflow, index) => (
                        <Link
                            key={workflow.title}
                            href={workflow.href}
                            prefetch
                            className="group grid gap-3 rounded-xl border p-6 transition-colors hover:bg-muted/50"
                        >
                            <span className="text-xs font-medium text-muted-foreground tabular-nums">
                                {String(index + 1).padStart(2, '0')}
                            </span>
                            <h2 className="flex items-center gap-2 text-lg font-semibold">
                                {workflow.icon && (
                                    <workflow.icon className="size-5" />
                                )}
                                {workflow.title}
                            </h2>
                            <p className="text-sm text-muted-foreground">
                                {workflow.description}
                            </p>
                            <span className="inline-flex items-center gap-1 text-sm font-medium">
                                Open {workflow.title}
                                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                            </span>
                        </Link>
                    ))}
                </div>

                <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                    <ShieldCheck className="size-4" />
                    Your workbooks are processed locally on this device and
                    never uploaded to the server.
                </p>
            </div>
        </>
    );
}

Dashboard.layout = {
    breadcrumbs: [{ title: 'Dashboard', href: dashboard() }],
};
