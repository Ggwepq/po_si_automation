import { Clock, FileText } from 'lucide-react';
import { SectionHeading } from '@/components/workbook/result-widgets';
import { Button } from '@/components/ui/button';
import { DeliveryStatus } from '../lib/types';
import type { DeliveryResult } from '../lib/types';

/**
 * Placeholder for sales invoice generation. Disabled until the invoice format,
 * invoice data, and GR No. mapping are confirmed.
 */
export function InvoicePreview({ results }: { results: DeliveryResult[] }) {
    const delivered = [
        ...new Map(
            results
                .filter((r) => r.status === DeliveryStatus.Delivered)
                .map((r) => [r.poNumber, r]),
        ).values(),
    ];

    return (
        <section className="grid gap-6">
            <SectionHeading
                eyebrow="Next step"
                title="Sales invoices"
                description="Prepare invoices for delivered purchase orders."
                action={
                    <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Clock className="size-4" /> Awaiting template
                    </span>
                }
            />
            <div className="grid gap-6 rounded-xl border p-6 md:grid-cols-[1fr_280px]">
                <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-10 text-center">
                    <FileText className="size-8 text-muted-foreground" />
                    <h3 className="font-medium">Your invoice workspace</h3>
                    <p className="max-w-sm text-sm text-muted-foreground">
                        Sales invoice generation will be available once the
                        invoice format is supplied.
                    </p>
                </div>
                <div className="grid content-start gap-2 text-sm">
                    <strong>Delivered POs · {delivered.length}</strong>
                    {delivered.length ? (
                        delivered.map((r) => (
                            <div
                                key={r.poNumber}
                                className="flex justify-between gap-3"
                            >
                                <span className="font-mono">{r.poNumber}</span>
                                <span className="truncate text-muted-foreground">
                                    {r.vendorName}
                                </span>
                            </div>
                        ))
                    ) : (
                        <p className="text-muted-foreground">
                            No delivered POs in the current comparison.
                        </p>
                    )}
                </div>
            </div>
            <p className="text-sm text-muted-foreground">
                Portal exports need a confirmed GR number, SI number, invoice
                date, and invoice amount. Receipt No. has not yet been mapped to
                GR No.
            </p>
            <div className="flex flex-wrap gap-2">
                <Button variant="outline" disabled>
                    Generate Outright Submit Invoice
                </Button>
                <Button variant="outline" disabled>
                    Generate Outright SCR
                </Button>
            </div>
        </section>
    );
}
