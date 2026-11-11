<?php

namespace App\Domains\Sales\Actions;

use App\Domains\Sales\Models\DsrReport;
use App\Domains\Sales\Models\Site;
use App\Domains\Sales\Models\Vendor;
use Carbon\CarbonImmutable;

/** Filter choices for the sales report and the dates that have imported sales. */
class GetSalesReportFilters
{
    /** @return array<string, mixed> */
    public function handle(): array
    {
        /** @var list<string> $salesDates */
        $salesDates = DsrReport::query()
            ->distinct()
            ->orderBy('transaction_date')
            ->pluck('transaction_date')
            ->map(fn (mixed $date) => CarbonImmutable::parse($date)->toDateString())
            ->all();

        return [
            'vendors' => Vendor::query()->orderBy('name')->get(['code', 'name'])->toArray(),
            'companies' => Site::query()->distinct()->orderBy('company')->pluck('company')->all(),
            'sites' => Site::query()->orderBy('name')->get(['code', 'name', 'company'])->toArray(),
            // Lets the date picker mark days with data and jump to the latest.
            'salesDates' => $salesDates,
            'dataFrom' => $salesDates[0] ?? null,
            'dataTo' => $salesDates === [] ? null : $salesDates[array_key_last($salesDates)],
        ];
    }

    /** Reports open on the latest imported data, or today when nothing is imported yet. */
    public function latestDate(): CarbonImmutable
    {
        $last = DsrReport::max('transaction_date');

        return $last ? CarbonImmutable::parse($last) : CarbonImmutable::today();
    }
}
