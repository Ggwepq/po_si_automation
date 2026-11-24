<?php

namespace App\Domains\Sales\Actions;

use App\Domains\Sales\Data\ReportFilter;
use App\Domains\Sales\Data\ReportPeriod;
use App\Domains\Sales\Enums\ReconcileStatus;
use App\Domains\Sales\Models\DsrLine;
use App\Domains\Sales\Models\DsrSummary;
use App\Domains\Sales\Models\Site;
use App\Domains\Sales\Support\SalesReportCache;
use App\Domains\Sales\Support\SalesScope;
use Illuminate\Support\Collection;

/**
 * Month-end check: compares SM's DSR Summary (official daily total per store)
 * with the sum of the imported DSR lines for the same store-day.
 *
 * Only vendor-days covered by an imported Summary are checked, so a month
 * whose Summary is not imported yet is reported as "not checked" rather than
 * wrong. Amounts are compared to the centavo.
 *
 * @phpstan-type CheckedDay array{siteId: int, date: string, summary: numeric-string|null, detail: numeric-string|null, difference: numeric-string, status: ReconcileStatus}
 * @phpstan-type StoreCheck array{code: string, name: string, company: string, summary: numeric-string, detail: numeric-string, difference: numeric-string, issues: int}
 */
class ReconcileDsr
{
    /** The panel lists the first issues only; the counts cover all of them. */
    private const MAX_ISSUES = 200;

    public function __construct(private SalesReportCache $cache) {}

    /** @return array<string, mixed> */
    public function handle(ReportPeriod $period, ReportFilter $filter): array
    {
        return $this->cache->remember([
            'reconcile' => true,
            'start' => $period->start->toDateString(),
            'end' => $period->end->toDateString(),
            ...$filter->cacheKey(),
        ], fn () => $this->build($period, $filter));
    }

    /** @return array<string, mixed> */
    private function build(ReportPeriod $period, ReportFilter $filter): array
    {
        $counts = array_fill_keys(array_map(fn (ReconcileStatus $s) => $s->value, ReconcileStatus::cases()), 0);
        $summaries = $this->amounts(
            SalesScope::apply(DsrSummary::query(), $filter, $period->start, $period->end)
                ->toBase()
                ->get(['vendor_id', 'site_id', 'transaction_date', 'total_sales AS amount']),
        );

        if ($summaries === []) {
            return ['checked' => false, 'daysChecked' => 0, 'counts' => $counts, 'summaryTotal' => '0.00',
                'detailTotal' => '0.00', 'difference' => '0.00', 'balanced' => false, 'issues' => [], 'stores' => []];
        }

        $details = $this->amounts(
            SalesScope::apply(DsrLine::query(), $filter, $period->start, $period->end)
                ->toBase()
                ->selectRaw('vendor_id, site_id, transaction_date, SUM(total_sales) AS amount')
                ->groupBy('vendor_id', 'site_id', 'transaction_date')
                ->get(),
        );

        $days = $this->compare($summaries, $details);
        $sites = Site::whereIn('id', array_unique(array_column($days, 'siteId')))->get(['id', 'code', 'name', 'company'])->keyBy('id');
        $summaryTotal = '0.00';
        $detailTotal = '0.00';
        $issues = [];

        foreach ($days as $day) {
            $counts[$day['status']->value]++;
            $summaryTotal = bcadd($summaryTotal, $day['summary'] ?? '0', 2);
            $detailTotal = bcadd($detailTotal, $day['detail'] ?? '0', 2);

            if ($day['status']->isIssue()) {
                $issues[] = $day;
            }
        }

        return [
            'checked' => true,
            'daysChecked' => count(array_unique(array_column($days, 'date'))),
            'counts' => $counts,
            'summaryTotal' => $summaryTotal,
            'detailTotal' => $detailTotal,
            'difference' => bcsub($detailTotal, $summaryTotal, 2),
            'balanced' => $issues === [],
            'issues' => collect($issues)
                ->sortBy(fn (array $day) => $day['date'].'|'.$sites[$day['siteId']]->name)
                ->take(self::MAX_ISSUES)
                ->map(fn (array $day) => [
                    'date' => $day['date'],
                    'siteCode' => $sites[$day['siteId']]->code,
                    'siteName' => $sites[$day['siteId']]->name,
                    'company' => $sites[$day['siteId']]->company,
                    'summary' => $day['summary'],
                    'detail' => $day['detail'],
                    'difference' => $day['difference'],
                    'status' => $day['status']->value,
                ])
                ->values()
                ->all(),
            'stores' => $this->stores($days, $sites),
        ];
    }

    /**
     * One entry per store-day in either source. DSR lines on vendor-days
     * the Summary does not cover are left out: there is nothing to check
     * them against yet.
     *
     * @param  array<string, numeric-string>  $summaries
     * @param  array<string, numeric-string>  $details
     * @return list<CheckedDay>
     */
    private function compare(array $summaries, array $details): array
    {
        $coveredVendorDays = [];

        foreach (array_keys($summaries) as $key) {
            $coveredVendorDays[$this->vendorDay($key)] = true;
        }

        $days = [];

        foreach (array_keys($summaries + $details) as $key) {
            if (! isset($coveredVendorDays[$this->vendorDay($key)])) {
                continue;
            }

            [, $siteId, $date] = explode('|', $key);
            $summary = $summaries[$key] ?? null;
            $detail = $details[$key] ?? null;

            $days[] = [
                'siteId' => (int) $siteId,
                'date' => $date,
                'summary' => $summary,
                'detail' => $detail,
                'difference' => bcsub($detail ?? '0', $summary ?? '0', 2),
                'status' => $this->status($summary, $detail),
            ];
        }

        return $days;
    }

    /**
     * @param  numeric-string|null  $summary
     * @param  numeric-string|null  $detail
     */
    private function status(?string $summary, ?string $detail): ReconcileStatus
    {
        return match (true) {
            $summary === null => ReconcileStatus::NotInSummary,
            $detail === null => bccomp($summary, '0', 2) === 0 ? ReconcileStatus::NoSales : ReconcileStatus::NotImported,
            bccomp($summary, $detail, 2) === 0 => ReconcileStatus::Match,
            default => ReconcileStatus::Differs,
        };
    }

    /**
     * @param  list<CheckedDay>  $days
     * @param  Collection<int, Site>  $sites
     * @return list<StoreCheck>
     */
    private function stores(array $days, Collection $sites): array
    {
        $stores = [];

        foreach ($days as $day) {
            $site = $sites[$day['siteId']];
            $store = $stores[$site->id] ?? ['code' => $site->code, 'name' => $site->name, 'company' => $site->company,
                'summary' => '0.00', 'detail' => '0.00', 'difference' => '0.00', 'issues' => 0];

            $store['summary'] = bcadd($store['summary'], $day['summary'] ?? '0', 2);
            $store['detail'] = bcadd($store['detail'], $day['detail'] ?? '0', 2);
            $store['difference'] = bcsub($store['detail'], $store['summary'], 2);
            $store['issues'] += $day['status']->isIssue() ? 1 : 0;
            $stores[$site->id] = $store;
        }

        usort($stores, fn (array $a, array $b) => [$b['issues'], $a['company'], $a['name']] <=> [$a['issues'], $b['company'], $b['name']]);

        return $stores;
    }

    /**
     * Databases return amounts as decimal strings (MySQL) or floats (SQLite);
     * rounding to centavos gives an exact string for bc math either way.
     *
     * @param  Collection<int, \stdClass>  $rows
     * @return array<string, numeric-string> amount by vendor|site|date
     */
    private function amounts(Collection $rows): array
    {
        $amounts = [];

        foreach ($rows as $row) {
            $key = $row->vendor_id.'|'.$row->site_id.'|'.substr((string) $row->transaction_date, 0, 10);
            $amounts[$key] = number_format(round((float) $row->amount, 2), 2, '.', '');
        }

        return $amounts;
    }

    private function vendorDay(string $key): string
    {
        [$vendorId, , $date] = explode('|', $key);

        return $vendorId.'|'.$date;
    }
}
