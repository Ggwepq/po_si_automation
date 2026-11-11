<?php

namespace App\Domains\Sales\Actions;

use App\Domains\Sales\Models\DsrReport;
use App\Domains\Sales\Models\Site;
use Carbon\CarbonImmutable;

/** Filter choices for the sales report and the range of imported data. */
class GetSalesReportFilters
{
    /** @return array<string, mixed> */
    public function handle(): array
    {
        $first = DsrReport::min('transaction_date');
        $last = DsrReport::max('transaction_date');

        return [
            'companies' => Site::query()->distinct()->orderBy('company')->pluck('company')->all(),
            'sites' => Site::query()->orderBy('name')->get(['code', 'name', 'company'])->toArray(),
            'dataFrom' => $first ? CarbonImmutable::parse($first)->toDateString() : null,
            'dataTo' => $last ? CarbonImmutable::parse($last)->toDateString() : null,
        ];
    }

    /** Reports open on the latest imported data, or today when nothing is imported yet. */
    public function latestDate(): CarbonImmutable
    {
        $last = DsrReport::max('transaction_date');

        return $last ? CarbonImmutable::parse($last) : CarbonImmutable::today();
    }
}
