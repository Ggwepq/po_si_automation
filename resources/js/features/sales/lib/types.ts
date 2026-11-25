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
    kind: 'detail';
    reports: DsrReportInput[];
    warnings: string[];
};

/** SM's official total for a vendor, store and day (DSR Summary export). */
export type DsrSummaryInput = {
    vendor_code: string;
    vendor_name: string;
    site_code: string;
    site_name: string;
    company: string;
    /** YYYY-MM-DD */
    transaction_date: string;
    total_sales: string;
};

export type ParsedDsrSummaryFile = {
    kind: 'summary';
    summaries: DsrSummaryInput[];
    warnings: string[];
};

/** One store's items for a half-month, from SM's Consolidated Sales Report. */
export type CsrStoreInput = {
    vendor_code: string;
    vendor_name: string;
    site_code: string;
    site_name: string;
    company: string;
    /** YYYY-MM-DD */
    period_start: string;
    period_end: string;
    lines: DsrLineInput[];
};

export type ParsedCsrFile = {
    kind: 'csr';
    stores: CsrStoreInput[];
    warnings: string[];
};

/** What one SM chain head office owes for a half-month (Consolidated Liquidation Report). */
export type LiquidationInput = {
    vendor_code: string;
    vendor_name: string;
    /** "Countering center", e.g. 8888 SVI HEADOFFICE. */
    center_code: string;
    center_name: string;
    /** Store chain, e.g. SVI. */
    chain: string;
    payment_term: string | null;
    period_start: string;
    period_end: string;
    amount_payable: string;
    ewt: string;
    net_due: string;
    stores: {
        site_code: string;
        site_name: string;
        company: string;
        vat_exempt_sales: string;
        vatable_sales: string;
        vat_amount: string;
        total_sales: string;
    }[];
};

export type ParsedClrFile = {
    kind: 'clr';
    liquidations: LiquidationInput[];
    warnings: string[];
};

/** Any export the Import page accepts. */
export type ParsedSalesFile =
    | ParsedDsrFile
    | ParsedDsrSummaryFile
    | ParsedCsrFile
    | ParsedClrFile;

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
    /** Null until some sold items have a cost. Uses only the costed sales. */
    grossProfit: number | null;
    grossMargin: number | null;
    /** Share of sales whose items had a cost on the day sold (0-100). */
    costCoverage: number;
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
    /** Null until some sold items have a cost. Uses only the costed sales. */
    grossProfit: number | null;
    grossMargin: number | null;
    /** Share of sales whose items had a cost on the day sold (0-100). */
    costCoverage: number;
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
    /** Null until some sold items have a cost. Uses only the costed sales. */
    grossProfit: number | null;
    grossMargin: number | null;
    /** Share of sales whose items had a cost on the day sold (0-100). */
    costCoverage: number;
};

export type TrendPoint = { date: string; sales: number; qty: number };

export type SalesReport = {
    summary: SalesTotals & { previous: SalesTotals };
    byCompany: CompanySales[];
    byStore: StoreSales[];
    items: ItemSales[];
    trend: { grouping: 'day' | 'month'; points: TrendPoint[] };
};

/** Quantity and sales per item, in the order of `SalesMatrix.items`. */
export type MatrixRow = { qty: number[]; sales: number[] };

/** Item grids by day (or month) and by store, for the Excel export. */
export type SalesMatrix = {
    grouping: 'day' | 'month';
    items: { code: string; description: string; uom: string | null }[];
    byDate: (MatrixRow & { date: string })[];
    byStore: (MatrixRow & { code: string; name: string; company: string })[];
};

/** A year of ModCon billing: per store chain, each item's sales and quantity per half-month (24 halves). */
export type ModconSummary = {
    year: number;
    items: { code: string; description: string }[];
    /** amount[item][half] and qty[item][half]. */
    chains: { chain: string; amount: number[][]; qty: number[][] }[];
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
        /** Days without a DSR that SM's DSR Summary shows as no sales (0.00 or not listed). */
        noSalesDays: number;
        /** Those 0.00 days (day mode only). */
        noSales: string[];
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

export type ReconcileStatus =
    | 'match'
    | 'no_sales'
    | 'differs'
    | 'not_imported'
    | 'not_in_summary';

/** Month-end check of the imported DSRs against SM's DSR Summary. */
export type DsrReconciliation = {
    /** False when no DSR Summary is imported for this period. */
    checked: boolean;
    balanced: boolean;
    daysChecked: number;
    counts: Record<ReconcileStatus, number>;
    /** Exact decimal strings, e.g. "1146.38". */
    summaryTotal: string;
    detailTotal: string;
    difference: string;
    /** Store-days that need attention (first 200). */
    issues: {
        date: string;
        siteCode: string;
        siteName: string;
        company: string;
        summary: string | null;
        detail: string | null;
        difference: string;
        status: ReconcileStatus;
    }[];
    stores: {
        code: string;
        name: string;
        company: string;
        summary: string;
        detail: string;
        difference: string;
        issues: number;
    }[];
};

/** An item on the Product costs page. */
export type ProductCost = {
    code: string;
    description: string;
    uom: string | null;
    /** Cost in effect today, per unit. */
    currentCost: number | null;
    /** What SM paid per unit on the item's latest DSR day. */
    smPrice: number | null;
    /** (SM price - cost) / SM price, in %. */
    margin: number | null;
    /** Sales over the last 60 days of DSRs, to weigh what the costs cover. */
    recentSales: number;
    history: {
        id: number;
        unitCost: number;
        /** YYYY-MM-DD */
        effectiveFrom: string;
        setBy: string | null;
        upcoming: boolean;
    }[];
};

export type LiquidationStatus = 'unpaid' | 'short' | 'paid' | 'over';

/** One SM head office's liquidation for a half-month, checked against the DSRs. */
export type Liquidation = {
    id: number;
    /** YYYY-MM-DD */
    periodStart: string;
    periodEnd: string;
    centerCode: string;
    centerName: string;
    chain: string;
    paymentTerm: string | null;
    /** Sales before VAT, as SM liquidated them. */
    sales: number;
    vat: number;
    amountPayable: number;
    ewt: number;
    netDue: number;
    /** Imported DSR sales for the same stores and days. */
    dsrSales: number;
    dsrDifference: number;
    dsrMatches: boolean;
    csrImported: boolean;
    paid: number;
    balance: number;
    status: LiquidationStatus;
    payments: {
        id: number;
        paidOn: string;
        reference: string | null;
        amount: number;
        recordedBy: string | null;
    }[];
    stores: {
        code: string;
        name: string;
        smSales: number;
        vat: number;
        totalSales: number;
        dsrSales: number;
        difference: number;
        /** Days in the period (up to today) without an imported DSR. */
        missingDays: string[];
        csrSales: number | null;
    }[];
};

/** Per store, SM's Consolidated Sales Report against the DSRs, item by item. */
export type LiquidationItems = {
    stores: {
        code: string;
        name: string;
        items: {
            code: string;
            description: string;
            csrQty: number | null;
            csrSales: number | null;
            dsrQty: number;
            dsrSales: number;
        }[];
    }[];
};
