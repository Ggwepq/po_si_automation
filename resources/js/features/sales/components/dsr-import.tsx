import { ImportFlow } from './import/import-flow';
import { ImportHistory } from './import-history';
import type { ImportRecord } from './import-history';

/** The Import page: the import flow, with the recent imports under it. */
export function DsrImport({ imports }: { imports: ImportRecord[] }) {
    return (
        <div className="grid grid-cols-1 gap-6 p-4 md:p-6">
            <header className="space-y-1">
                <h1 className="text-2xl font-semibold tracking-tight">
                    Import
                </h1>
                <p className="max-w-2xl text-sm text-muted-foreground">
                    Upload any export from the SM Vendor Portal: the DSR (Export
                    Document) for daily sales, the DSR Summary to check a month,
                    and the Consolidated Sales and Liquidation Reports for what
                    SM owes you. The file type is recognised automatically.
                </p>
            </header>

            <div className="max-w-3xl">
                <ImportFlow />
            </div>

            <ImportHistory imports={imports} />
        </div>
    );
}
