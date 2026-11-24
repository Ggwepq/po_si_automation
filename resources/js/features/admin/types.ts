import type { CompanyBrand } from '@/types';

/** Laravel's paginator as Inertia receives it. */
export type Paginated<T> = {
    data: T[];
    current_page: number;
    last_page: number;
    prev_page_url: string | null;
    next_page_url: string | null;
    total: number;
};

export type CompanyRow = CompanyBrand & {
    userCount: number;
    createdAt: string | null;
};

export type CompanyUserRow = {
    id: number;
    name: string;
    email: string;
    createdAt: string | null;
};
