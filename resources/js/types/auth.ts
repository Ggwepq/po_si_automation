export type User = {
    id: number;
    company_id: number | null;
    is_super_admin: boolean;
    name: string;
    email: string;
    avatar?: string;
    email_verified_at: string | null;
    two_factor_enabled?: boolean;
    created_at: string;
    updated_at: string;
    [key: string]: unknown;
};

/** The company a user works for, as shown in the sidebar and on reports. */
export type CompanyBrand = {
    id: number;
    name: string;
    /** SM Vendor Portal number, used to log in. */
    accountNumber: string | null;
    slug: string;
    logoUrl: string | null;
    /** PO & SI workflow and RA item matching (Oroza Enterprise only). */
    workbookTools: boolean;
};

export type Auth = {
    user: User;
    isSuperAdmin: boolean;
    /** Null for super admins, who belong to no company. */
    company: CompanyBrand | null;
};

export type TwoFactorSetupData = {
    svg: string;
    url: string;
};

export type TwoFactorSecretKey = {
    secretKey: string;
};

/** Shared with company users on every page. */
export type SalesStatus = {
    /** YYYY-MM-DD of the latest imported DSR; null before the first. */
    lastDsrDate: string | null;
    /** Rows per request when importing, matching the server's limits. */
    importLimits: {
        reportsPerBatch: number;
        linesPerReport: number;
        summariesPerBatch: number;
        csrStoresPerBatch: number;
        liquidationsPerBatch: number;
    };
};
