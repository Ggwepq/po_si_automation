<?php

namespace App\Domains\Sales\Actions;

use App\Domains\Sales\Data\ReportFilter;
use App\Domains\Sales\Data\ReportPeriod;
use App\Domains\Sales\Models\DsrLine;
use App\Domains\Sales\Models\DsrSummary;
use App\Domains\Sales\Models\Site;
use App\Domains\Sales\Support\SalesReportCache;
use App\Domains\Sales\Support\SalesScope;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;

/**
 * Shows which store-days of a period have an imported DSR, so a missed
 * import is visible before the report is trusted.
 *
 * A store is expected when it has DSRs in this period or the one before (or
 * appears in SM's DSR Summary), so a store missing for the whole month still
 * appears. Only days up to yesterday are checked: SM posts a day's DSR the
 * next day. A store-day counts as accounted for when its DSR is imported or
 * when SM's DSR Summary for that day shows 0.00 or omits the store (no
 * sales, so SM issues no DSR).
 * Reads dsr_lines (indexed by date + site; every DSR has lines) rather than
 * dsr_reports.
 *
 * @phpstan-type StoreCoverage array{code: string, name: string, company: string, importedDays: int, noSalesDays: int, noSales: list<string>, missing: list<string>, months: list<array{month: string, imported: int, days: int}>}
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

        $imported = $this->datesBySite(SalesScope::apply(DsrLine::query(), $filter, $period->start, $last));
        $summaries = fn () => SalesScope::apply(DsrSummary::query(), $filter, $period->start, $last);
        $summaryDays = $summaries()->distinct()->pluck('transaction_date')
            ->map(fn ($date) => CarbonImmutable::parse($date)->toDateString());
        $summarySalesDays = $this->datesBySite($summaries()->where('total_sales', '<>', 0));

        $previous = $period->previous();
        $expectedIds = SalesScope::apply(DsrLine::query(), $filter, $previous->start, $last)->distinct()->pluck('site_id')
            ->merge(SalesScope::apply(DsrSummary::query(), $filter, $period->start, $last)->distinct()->pluck('site_id'))
            ->unique();
        $sites = Site::whereIn('id', $expectedIds)->orderBy('company')->orderBy('name')->get();

        // A day with no DSR at all is only expected when SM shows no sales.
        $accountedDays = $imported->flatten()
            ->merge($summaryDays->diff($summarySalesDays->flatten()))
            ->unique();
        $daysWithoutAnyDsr = array_values(array_filter($days, fn (string $day) => ! $accountedDays->contains($day)));

        $stores = $sites->map(function (Site $site) use ($imported, $summaryDays, $summarySalesDays, $days, $byMonth) {
            /** @var Collection<int, string> $dsrDates */
            $dsrDates = $imported->get($site->id, collect());
            // On a day SM's Summary covers, a store with 0.00 or no row
            // at all sold nothing, so a missing DSR is expected.
            $zeroDates = $summaryDays
                ->diff($summarySalesDays->get($site->id, collect()))
                ->diff($dsrDates)
                ->values();
            $accounted = $dsrDates->merge($zeroDates);

            return [
                'code' => $site->code,
                'name' => $site->name,
                'company' => $site->company,
                'importedDays' => $dsrDates->count(),
                'noSalesDays' => $zeroDates->count(),
                'noSales' => $byMonth ? [] : $zeroDates->sort()->values()->all(),
                'missing' => $byMonth ? [] : array_values(array_diff($days, $accounted->all())),
                'months' => $byMonth ? $this->monthly($days, $accounted) : [],
            ];
        })->values()->all();

        return [
            'mode' => $byMonth ? 'month' : 'day',
            'days' => $byMonth ? [] : $days,
            'daysChecked' => count($days),
            'daysWithoutAnyDsr' => $daysWithoutAnyDsr,
            'stores' => $stores,
            'complete' => collect($stores)->every(fn (array $s) => count($days) === $s['importedDays'] + $s['noSalesDays']),
        ];
    }

    /**
     * @template TModel of Model
     *
     * @param  Builder<TModel>  $query
     * @return Collection<int, Collection<int, string>> dates by site id
     */
    private function datesBySite(Builder $query): Collection
    {
        return $query->toBase()
            ->select('site_id', 'transaction_date')
            ->distinct()
            ->get()
            ->groupBy('site_id')
            ->map(fn (Collection $rows) => $rows
                ->map(fn ($row) => CarbonImmutable::parse($row->transaction_date)->toDateString())
                ->unique()
                ->values());
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
