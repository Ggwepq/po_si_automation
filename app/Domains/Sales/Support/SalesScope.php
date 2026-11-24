<?php

namespace App\Domains\Sales\Support;

use App\Domains\Sales\Data\ReportFilter;
use App\Domains\Sales\Models\Site;
use App\Domains\Sales\Models\Vendor;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

/**
 * Narrows any per-store-day sales table (dsr_lines, dsr_summaries) to one
 * company, a date range and the report filter, so every report reads the
 * same rows and never another company's.
 */
final class SalesScope
{
    /**
     * Both tables store transaction_date as a plain Y-m-d, so whereBetween
     * includes the last day on every database.
     *
     * @template TModel of Model
     *
     * @param  Builder<TModel>  $query
     * @return Builder<TModel>
     */
    public static function apply(Builder $query, ReportFilter $filter, CarbonImmutable $from, CarbonImmutable $to): Builder
    {
        return $query
            ->where('company_id', $filter->companyId)
            ->whereBetween('transaction_date', [$from->toDateString(), $to->toDateString()])
            ->when($filter->vendorCodes, fn (Builder $q, array $codes) => $q->whereIn('vendor_id', Vendor::select('id')->whereIn('code', $codes)))
            ->when($filter->companies, fn (Builder $q, array $companies) => $q->whereIn('site_id', Site::select('id')->whereIn('company', $companies)))
            ->when($filter->siteCodes, fn (Builder $q, array $codes) => $q->whereIn('site_id', Site::select('id')->whereIn('code', $codes)));
    }
}
