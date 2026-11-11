/** Shapes shared between the DSR import, the server and the sales report. */

export type DsrLineInput = {
    article_code: string;
    description: string;
    barcode: string | null;
    uom: string | null;
    /** Decimal numbers are sent as plain strings so money stays exact. */
    sales_qty: string;
    vat_exempt_sales: string;
    vatable_sales: string;
    total_sales: string;
};

export type DsrReportInput = {
    vendor_code: string;
    vendor_name: string;
    site_code: string;
    site_name: string;
    company: string;
    /** YYYY-MM-DD */
    transaction_date: string;
    data_status: string | null;
    lines: DsrLineInput[];
};

export type ParsedDsrFile = {
    reports: DsrReportInput[];
    warnings: string[];
};

export type PeriodType =
    | 'daily'
    | 'weekly'
    | 'monthly'
    | 'quarterly'
    | 'yearly'
    | 'custom';

export type PeriodRange = { start: string; end: string; label: string };

export type ReportPeriod = PeriodRange & {
    type: PeriodType;
    days: number;
    previous: PeriodRange;
    next: PeriodRange;
};

export type SalesTotals = {
    totalSales: number;
    totalQty: number;
    itemCount: number;
    storeCount: number;
    salesDays: number;
    averageDailySales: number;
};

export type StoreSales = {
    code: string;
    name: string;
    company: string;
    sales: number;
    qty: number;
    itemCount: number;
    share: number;
    topItem: string | null;
};

export type CompanySales = {
    company: string;
    sales: number;
    qty: number;
    storeCount: number;
    share: number;
};

export type ItemSales = {
    code: string;
    description: string;
    uom: string | null;
    qty: number;
    sales: number;
    share: number;
    averagePrice: number;
    storeCount: number;
};

export type TrendPoint = { date: string; sales: number; qty: number };

export type SalesReport = {
    summary: SalesTotals & { previous: SalesTotals };
    byCompany: CompanySales[];
    byStore: StoreSales[];
    items: ItemSales[];
    trend: { grouping: 'day' | 'month'; points: TrendPoint[] };
};

export type ReportFilters = {
    vendors: { code: string; name: string }[];
    companies: string[];
    sites: { code: string; name: string; company: string }[];
    /** YYYY-MM-DD days that have imported sales, oldest first. */
    salesDates: string[];
    dataFrom: string | null;
    dataTo: string | null;
};

/** Which store-days have an imported DSR (checked up to yesterday). */
export type DsrCoverage = {
    mode: 'day' | 'month';
    /** Every checked day (day mode only). */
    days: string[];
    daysChecked?: number;
    /** Days on which no store at all has a DSR: usually a missed import. */
    daysWithoutAnyDsr: string[];
    stores: {
        code: string;
        name: string;
        company: string;
        importedDays: number;
        /** Days without a DSR (day mode only). */
        missing: string[];
        /** Per-month counts (month mode only). */
        months: { month: string; imported: number; days: number }[];
    }[];
    complete: boolean;
};

/** Selected filter values; empty lists mean "all". */
export type ReportSelection = {
    vendors: string[];
    companies: string[];
    sites: string[];
};
