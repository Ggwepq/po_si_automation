<?php

namespace App\Domains\Sales\Actions;

use App\Domains\Sales\Models\DsrReport;
use App\Domains\Sales\Models\DsrSummary;
use App\Domains\Sales\Models\Site;
use App\Domains\Sales\Models\Vendor;
use Carbon\CarbonImmutable;

/**
 * Filter choices for a company's sales report and the dates that have
 * imported sales. Vendors and stores are shared tables, so only those that
 * appear in this company's own imports are offered.
 */
class GetSalesReportFilters
{
    /** @return array<string, mixed> */
    public function handle(int $companyId): array
    {
        /** @var list<string> $salesDates */
        $salesDates = DsrReport::query()
            ->where('company_id', $companyId)
            ->distinct()
            ->orderBy('transaction_date')
            ->pluck('transaction_date')
            ->map(fn (mixed $date) => CarbonImmutable::parse($date)->toDateString())
            ->all();

        $siteIds = DsrReport::query()->where('company_id', $companyId)->select('site_id')
            ->union(DsrSummary::query()->where('company_id', $companyId)->select('site_id'));
        $vendorIds = DsrReport::query()->where('company_id', $companyId)->select('vendor_id')
            ->union(DsrSummary::query()->where('company_id', $companyId)->select('vendor_id'));
        $sites = Site::query()->whereIn('id', $siteIds)->orderBy('name')->get(['code', 'name', 'company']);

        return [
            'vendors' => Vendor::query()->whereIn('id', $vendorIds)->orderBy('name')->get(['code', 'name'])->toArray(),
            'companies' => $sites->pluck('company')->unique()->sort()->values()->all(),
            'sites' => $sites->toArray(),
            // Lets the date picker mark days with data and jump to the latest.
            'salesDates' => $salesDates,
            'dataFrom' => $salesDates[0] ?? null,
            'dataTo' => $salesDates === [] ? null : $salesDates[array_key_last($salesDates)],
        ];
    }

    /** Reports open on the company's latest imported data, or today when nothing is imported yet. */
    public function latestDate(int $companyId): CarbonImmutable
    {
        $last = DsrReport::where('company_id', $companyId)->max('transaction_date');

        return $last ? CarbonImmutable::parse($last) : CarbonImmutable::today();
    }
}
