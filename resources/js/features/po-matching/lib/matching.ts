import { cellText } from '@/lib/workbook-file';
import { DeliveryStatus } from './types';
import type { DeliveryResult, DeliverySummary, ParsedSheet } from './types';

type MatchInput = Pick<ParsedSheet, 'poColumn' | 'rows'>;

/** PO numbers match as exact text after trimming; prefixes and leading zeros matter. */
export const normalizePO = cellText;

export const isPOHeader = (value: unknown): boolean =>
    /^po\s*(no\.?|number)$/i.test(cellText(value));

const isReceiptHeader = (header: string): boolean =>
    /^receipt\s*no\.?$/i.test(header);

/**
 * Marks every PO item row Delivered when its PO number appears anywhere in GR.
 * Quantities and partial deliveries are deliberately not evaluated.
 */
export function compareWorkbooks(
    po: MatchInput,
    gr: MatchInput & Pick<ParsedSheet, 'headers'>,
): DeliveryResult[] {
    const receipts = new Map<string, ParsedSheet['rows']>();

    for (const row of gr.rows) {
        const key = normalizePO(row[gr.poColumn]);

        if (!key) {
            continue;
        }

        const matches = receipts.get(key) ?? [];
        matches.push(row);
        receipts.set(key, matches);
    }

    const receiptColumn = gr.headers.find(isReceiptHeader);

    return po.rows.map((row, index) => {
        const key = normalizePO(row[po.poColumn]);
        const matches = key ? (receipts.get(key) ?? []) : [];
        const receiptNumbers = receiptColumn
            ? matches
                  .map((match) => normalizePO(match[receiptColumn]))
                  .filter(Boolean)
            : [];

        let status: DeliveryStatus = DeliveryStatus.Undelivered;

        if (!key) {
            status = DeliveryStatus.NeedsReview;
        } else if (matches.length) {
            status = DeliveryStatus.Delivered;
        }

        return {
            id: index,
            original: row,
            poNumber: key,
            grPO: matches.length ? key : '',
            receiptNumbers: [...new Set(receiptNumbers)],
            vendorCode: row['Vendor Code'] ?? '',
            vendorName: row['Vendor Name'] ?? '',
            status,
        };
    });
}

export function summarize(
    results: DeliveryResult[],
    gr: MatchInput,
): DeliverySummary {
    const statusByPO = new Map<string, DeliveryStatus>();

    for (const result of results) {
        if (result.poNumber) {
            statusByPO.set(result.poNumber, result.status);
        }
    }

    const statuses = [...statusByPO.values()];
    const grKeys = new Set(
        gr.rows.map((row) => normalizePO(row[gr.poColumn])).filter(Boolean),
    );

    return {
        total: statusByPO.size,
        delivered: statuses.filter(
            (status) => status === DeliveryStatus.Delivered,
        ).length,
        undelivered: statuses.filter(
            (status) => status === DeliveryStatus.Undelivered,
        ).length,
        review: results.filter(
            (result) => result.status === DeliveryStatus.NeedsReview,
        ).length,
        unmatchedGR: [...grKeys].filter((key) => !statusByPO.has(key)).length,
    };
}
