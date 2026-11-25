import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { parseSalesWorkbook } from './parse-sales-file';
import { parseCenter, parsePeriod, parseSiteCell } from './parse-settlement';

const book = (rows: unknown[][]) => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.aoa_to_sheet(rows),
        'Sheet1',
    );

    return workbook;
};

const CSR_HEADER = [
    'Document Title',
    'Vendor Code',
    'Vendor Name',
    'Payment Term',
    'Transaction Date',
    'Item No.',
    'Article Code',
    'Description',
    'Barcode',
    'UOM',
    'Sales Qty',
    'VAT-Exempt Sales',
    'Vatable Sales',
    'Total Sales',
    'Net Sales',
    'Add:VAT',
    'Total Sales with VAT',
    'Site',
    'Important Remarks',
];

const csrRow = (item: string, qty: string, sales: string, site: string) => [
    'Consolidated Sales Report',
    '150551',
    'OROZA ENTERPRISES',
    'PT38',
    '11/01/2026 - 11/15/2026',
    '1',
    item,
    `ITEM ${item}`,
    '',
    'PC',
    qty,
    '0.00',
    sales,
    sales,
    '',
    '',
    '',
    site,
    '',
];

const CLR_HEADER = [
    'Document Title',
    'Vendor Code',
    'Vendor Name',
    'Countering Center',
    'Payment Term',
    'Document Date',
    'Item No.',
    'Site Code',
    'Site Name',
    'VAT-Exempt Sales',
    'Vatable Sales',
    'VAT Amount',
    'Total Sales',
    'Total Amount Payable',
    'Less: Expanded Withholding Tax',
    'Total Net Amount Due',
    'Important Remarks',
];

const clrRow = (
    center: string,
    site: string,
    name: string,
    vatable: string,
    vat: string,
    total: string,
    payable: string,
    ewt: string,
    net: string,
) => [
    'Consolidated Liquidation Report',
    '150551',
    'OROZA ENTERPRISES',
    center,
    'PT38',
    '11/01/2026 - 11/15/2026',
    '1',
    site,
    name,
    '0.00',
    vatable,
    vat,
    total,
    payable,
    ewt,
    net,
    'Please review your Details of Payment.',
];

describe('cell formats', () => {
    it('reads periods, stores and head offices', () => {
        expect(parsePeriod('11/01/2026 - 11/15/2026')).toEqual({
            start: '2026-11-01',
            end: '2026-11-15',
        });
        expect(parsePeriod('11/15/2026 - 11/01/2026')).toBeNull();
        expect(parseSiteCell('0779-SMCo FESTIVAL MALL')).toEqual({
            code: '0779',
            name: 'SMCo FESTIVAL MALL',
        });
        expect(parseCenter('8888 SVI HEADOFFICE')).toEqual({
            code: '8888',
            name: 'SVI HEADOFFICE',
            chain: 'SVI',
        });
    });
});

describe('Consolidated Sales Report', () => {
    it('groups item rows by store and period', () => {
        const parsed = parseSalesWorkbook(
            book([
                CSR_HEADER,
                csrRow(
                    '20586495',
                    '82.000',
                    '1,610.48',
                    '0779-SMCo FESTIVAL MALL',
                ),
                csrRow(
                    '20586496',
                    '63.000',
                    '1,237.32',
                    '0779-SMCo FESTIVAL MALL',
                ),
                csrRow('20586495', '10.000', '196.40', '0009-SVI MEGAMALL'),
                [
                    'Grand Total',
                    '',
                    '',
                    '',
                    '',
                    '',
                    '',
                    '',
                    '',
                    '',
                    '155.000',
                    '0.00',
                    '3,044.20',
                    '3,044.20',
                ],
            ]),
        );

        expect(parsed.kind).toBe('csr');

        if (parsed.kind !== 'csr') {
            return;
        }

        expect(parsed.warnings).toEqual([]);
        expect(parsed.stores).toHaveLength(2);
        expect(parsed.stores[0]).toMatchObject({
            site_code: '0779',
            site_name: 'SMCo FESTIVAL MALL',
            company: 'SMCo',
            period_start: '2026-11-01',
            period_end: '2026-11-15',
        });
        expect(parsed.stores[0].lines[0]).toMatchObject({
            article_code: '20586495',
            sales_qty: '82',
            total_sales: '1610.48',
        });
    });

    it('warns when the rows do not add up to the Grand Total', () => {
        const parsed = parseSalesWorkbook(
            book([
                CSR_HEADER,
                csrRow(
                    '20586495',
                    '82.000',
                    '1,610.48',
                    '0779-SMCo FESTIVAL MALL',
                ),
                [
                    'Grand Total',
                    '',
                    '',
                    '',
                    '',
                    '',
                    '',
                    '',
                    '',
                    '',
                    '',
                    '',
                    '',
                    '9,999.00',
                ],
            ]),
        );

        expect(parsed.warnings[0]).toMatch(/differs from its rows/);
    });
});

describe('Consolidated Liquidation Report', () => {
    it('reads one liquidation per head office and period, with its stores', () => {
        const parsed = parseSalesWorkbook(
            book([
                CLR_HEADER,
                clrRow(
                    '8888 SVI HEADOFFICE',
                    '0006',
                    'SVI NORTH EDSA',
                    '15,115.00',
                    '1,813.80',
                    '16,928.80',
                    '29,292.23',
                    '261.54',
                    '29,030.69',
                ),
                clrRow(
                    '8888 SVI HEADOFFICE',
                    '0009',
                    'SVI MEGAMALL',
                    '11,038.78',
                    '1,324.65',
                    '12,363.43',
                    '29,292.23',
                    '261.54',
                    '29,030.69',
                ),
                clrRow(
                    '8880 SMCo HEADOFFICE',
                    '0779',
                    'SMCo FESTIVAL MALL',
                    '10,629.05',
                    '1,275.49',
                    '11,904.54',
                    '11,904.54',
                    '106.29',
                    '11,798.25',
                ),
                [
                    'Grand Total',
                    '',
                    '',
                    '',
                    '',
                    '',
                    '',
                    '',
                    '',
                    '0.00',
                    '36,782.83',
                    '4,413.94',
                    '41,196.77',
                ],
            ]),
        );

        expect(parsed.kind).toBe('clr');

        if (parsed.kind !== 'clr') {
            return;
        }

        expect(parsed.warnings).toEqual([]);
        expect(parsed.liquidations).toHaveLength(2);

        const svi = parsed.liquidations.find((l) => l.chain === 'SVI');
        expect(svi).toMatchObject({
            center_code: '8888',
            center_name: 'SVI HEADOFFICE',
            payment_term: 'PT38',
            period_start: '2026-11-01',
            period_end: '2026-11-15',
            amount_payable: '29292.23',
            ewt: '261.54',
            net_due: '29030.69',
        });
        expect(svi?.stores.map((s) => s.site_code)).toEqual(['0006', '0009']);
        expect(svi?.stores[0]).toMatchObject({
            vatable_sales: '15115',
            vat_amount: '1813.8',
            total_sales: '16928.8',
        });
    });
});
