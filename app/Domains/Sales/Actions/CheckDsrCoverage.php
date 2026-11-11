<?php

namespace App\Domains\Sales\Actions;

use App\Domains\Sales\Data\ReportFilter;
use App\Domains\Sales\Data\ReportPeriod;
use App\Domains\Sales\Models\DsrLine;
use App\Domains\Sales\Models\Site;
use App\Domains\Sales\Models\Vendor;
use App\Domains\Sales\Support\SalesReportCache;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

/**
 * Shows which store-days of a period have an imported DSR, so a missed
 * import is visible before the report is trusted.
 *
 * A store is expected when it has DSRs in this period or the one before, so
 * a store missing for the whole month still appears. Only days up to
 * yesterday are checked: SM posts a day's DSR the next day. It reads
 * dsr_lines (indexed by date + site; every DSR has lines) rather than
 * dsr_reports. A day without any DSR from any store almost always means the
 * import for that day was skipped. A single store without a DSR may simply
 * have had no sales (SM only issues a DSR when something sold).
 *
 * @phpstan-type StoreCoverage array{code: string, name: string, company: string, importedDays: int, missing: list<string>, months: list<array{month: string, imported: int, days: int}>}
 */
class CheckDsrCoverage
{
    /** Longer periods are summarised per month instead of per day. */
    private const DAILY_DETAIL_MAX_DAYS = 92;

    public function __construct(private SalesReportCache $cache) {}

    /** @return array<string, mixed> */
    public function handle(ReportPeriod $period, ReportFilter $filter = new ReportFilter): array
    {
        return $this->cache->remember([
            'coverage' => true,
            'start' => $period->start->toDateString(),
            'end' => $period->end->toDateString(),
            'until' => CarbonImmutable::yesterday()->toDateString(),
            ...$filter->cacheKey(),
        ], fn () => $this->build($period, $filter));
    }

    /** @return array<string, mixed> */
    private function build(ReportPeriod $period, ReportFilter $filter): array
    {
        $last = $period->end->min(CarbonImmutable::yesterday());
        $days = $this->days($period->start, $last);
        $byMonth = count($days) > self::DAILY_DETAIL_MAX_DAYS;

        if ($days === []) {
            return ['mode' => 'day', 'days' => [], 'daysWithoutAnyDsr' => [], 'stores' => [], 'complete' => true];
        }

        $imported = $this->storeDays($filter, $period->start, $last)
            ->toBase()
            ->select('site_id', 'transaction_date')
            ->distinct()
            ->get()
            ->groupBy('site_id')
            ->map(fn (Collection $rows) => $rows
                ->map(fn ($row) => CarbonImmutable::parse($row->transaction_date)->toDateString())
                ->unique()
                ->values());

        $previous = $period->previous();
        $expectedIds = $this->storeDays($filter, $previous->start, $last)->distinct()->pluck('site_id');
        $sites = Site::whereIn('id', $expectedIds)->orderBy('company')->orderBy('name')->get();

        $daysWithDsr = $imported->flatten()->unique();
        $daysWithoutAnyDsr = array_values(array_filter($days, fn (string $day) => ! $daysWithDsr->contains($day)));

        $stores = $sites->map(function (Site $site) use ($imported, $days, $byMonth) {
            /** @var Collection<int, string> $dates */
            $dates = $imported->get($site->id, collect());
            $missing = array_values(array_diff($days, $dates->all()));

            return [
                'code' => $site->code,
                'name' => $site->name,
                'company' => $site->company,
                'importedDays' => $dates->count(),
                'missing' => $byMonth ? [] : $missing,
                'months' => $byMonth ? $this->monthly($days, $dates) : [],
            ];
        })->values()->all();

        return [
            'mode' => $byMonth ? 'month' : 'day',
            'days' => $byMonth ? [] : $days,
            'daysChecked' => count($days),
            'daysWithoutAnyDsr' => $daysWithoutAnyDsr,
            'stores' => $stores,
            'complete' => collect($stores)->every(fn (array $s) => $s['importedDays'] === count($days)),
        ];
    }

    /** @return Builder<DsrLine> */
    private function storeDays(ReportFilter $filter, CarbonImmutable $from, CarbonImmutable $to): Builder
    {
        return DsrLine::query()
            ->whereBetween('transaction_date', [$from->toDateString(), $to->toDateString()])
            ->when($filter->vendorCodes, fn (Builder $q, array $codes) => $q->whereIn('vendor_id', Vendor::select('id')->whereIn('code', $codes)))
            ->when($filter->companies, fn (Builder $q, array $companies) => $q->whereIn('site_id', Site::select('id')->whereIn('company', $companies)))
            ->when($filter->siteCodes, fn (Builder $q, array $codes) => $q->whereIn('site_id', Site::select('id')->whereIn('code', $codes)));
    }

    /** @return list<string> */
    private function days(CarbonImmutable $from, CarbonImmutable $to): array
    {
        $days = [];

        for ($day = $from; $day->lessThanOrEqualTo($to); $day = $day->addDay()) {
            $days[] = $day->toDateString();
        }

        return $days;
    }

    /**
     * @param  list<string>  $days
     * @param  Collection<int, string>  $dates
     * @return list<array{month: string, imported: int, days: int}>
     */
    private function monthly(array $days, Collection $dates): array
    {
        $imported = $dates->countBy(fn (string $date) => substr($date, 0, 7));

        return array_values(collect($days)
            ->countBy(fn (string $day) => substr($day, 0, 7))
            ->map(fn (int $count, string $month) => ['month' => $month, 'imported' => (int) $imported->get($month, 0), 'days' => $count])
            ->all());
    }
}
