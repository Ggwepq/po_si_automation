<?php

namespace App\Domains\Sales\Actions;

use App\Domains\Sales\Data\ReportPeriod;
use App\Domains\Sales\Models\Article;
use App\Domains\Sales\Models\DsrLine;
use App\Domains\Sales\Models\Site;
use App\Domains\Sales\Support\SalesReportCache;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

/**
 * Builds the sales report for a period: totals with a comparison to the
 * previous period, and sales by company, store, item and day.
 *
 * Totals are aggregated in SQL over dsr_lines (indexed by date + article and
 * date + site), so the cost grows with the number of stores and items in the
 * period, not with the size of the table.
 *
 * @phpstan-type StoreSales array{code: string, name: string, company: string, sales: float, qty: float, itemCount: int, share: float, topItem: string|null}
 * @phpstan-type CompanySales array{company: string, sales: float, qty: float, storeCount: int, share: float}
 * @phpstan-type ItemSales array{code: string, description: string, uom: string|null, qty: float, sales: float, share: float, averagePrice: float, storeCount: int}
 */
class BuildSalesReport
{
    public function __construct(private SalesReportCache $cache) {}

    /** @return array<string, mixed> */
    public function handle(ReportPeriod $period, ?string $company = null, ?string $siteCode = null): array
    {
        return $this->cache->remember([
            'type' => $period->type->value,
            'start' => $period->start->toDateString(),
            'end' => $period->end->toDateString(),
            'company' => $company,
            'site' => $siteCode,
        ], fn () => $this->build($period, $company, $siteCode));
    }

    /** @return array<string, mixed> */
    private function build(ReportPeriod $period, ?string $company, ?string $siteCode): array
    {
        $lines = fn (ReportPeriod $p) => $this->lines($p, $company, $siteCode);
        $stores = $this->byStore($lines($period));

        return [
            'summary' => [
                ...$this->summary($lines($period)),
                'previous' => $this->summary($lines($period->previous())),
            ],
            'byCompany' => $this->byCompany($stores),
            'byStore' => $stores->values()->all(),
            'items' => $this->byItem($lines($period)),
            'trend' => $this->trend($lines($period), $period),
        ];
    }

    /** @return Builder<DsrLine> */
    private function lines(ReportPeriod $period, ?string $company, ?string $siteCode): Builder
    {
        return DsrLine::query()
            ->whereBetween('transaction_date', [$period->start->toDateString(), $period->end->toDateString()])
            ->when($company, fn (Builder $q) => $q->whereIn('site_id', Site::select('id')->where('company', $company)))
            ->when($siteCode, fn (Builder $q) => $q->whereIn('site_id', Site::select('id')->where('code', $siteCode)));
    }

    /**
     * @param  Builder<DsrLine>  $lines
     * @return array<string, float|int>
     */
    private function summary(Builder $lines): array
    {
        $row = $lines->toBase()->selectRaw(
            'COALESCE(SUM(total_sales), 0) AS sales, COALESCE(SUM(sales_qty), 0) AS qty, '.
            'COUNT(DISTINCT article_id) AS items, COUNT(DISTINCT site_id) AS stores, '.
            'COUNT(DISTINCT transaction_date) AS days'
        )->first();

        $sales = $this->money($row->sales ?? 0);
        $days = (int) ($row->days ?? 0);

        return [
            'totalSales' => $sales,
            'totalQty' => $this->qty($row->qty ?? 0),
            'itemCount' => (int) ($row->items ?? 0),
            'storeCount' => (int) ($row->stores ?? 0),
            'salesDays' => $days,
            'averageDailySales' => $days > 0 ? round($sales / $days, 2) : 0.0,
        ];
    }

    /**
     * Sales per store, each with its best-selling item.
     *
     * @param  Builder<DsrLine>  $lines
     * @return Collection<int, StoreSales>
     */
    private function byStore(Builder $lines): Collection
    {
        $totals = (clone $lines)->toBase()
            ->selectRaw('site_id, SUM(total_sales) AS sales, SUM(sales_qty) AS qty, COUNT(DISTINCT article_id) AS items')
            ->groupBy('site_id')
            ->get();

        $topItemIds = (clone $lines)->toBase()
            ->selectRaw('site_id, article_id, SUM(total_sales) AS sales')
            ->groupBy('site_id', 'article_id')
            ->get()
            ->groupBy('site_id')
            ->map(fn (Collection $rows) => $rows->sortByDesc(fn ($row) => (float) $row->sales)->first()->article_id);

        $sites = Site::whereIn('id', $totals->pluck('site_id'))->get()->keyBy('id');
        $articles = Article::whereIn('id', $topItemIds->values())->pluck('description', 'id');
        $grandTotal = $totals->sum(fn ($row) => (float) $row->sales);

        return $totals
            ->map(function ($row) use ($sites, $articles, $topItemIds, $grandTotal) {
                $site = $sites[$row->site_id];
                $sales = $this->money($row->sales);
                $topItem = $articles->get($topItemIds->get($row->site_id));

                return [
                    'code' => $site->code,
                    'name' => $site->name,
                    'company' => $site->company,
                    'sales' => $sales,
                    'qty' => $this->qty($row->qty),
                    'itemCount' => (int) $row->items,
                    'share' => $this->share($sales, $grandTotal),
                    'topItem' => is_string($topItem) ? $topItem : null,
                ];
            })
            ->sortByDesc('sales')
            ->values();
    }

    /**
     * @param  Collection<int, StoreSales>  $stores
     * @return list<CompanySales>
     */
    private function byCompany(Collection $stores): array
    {
        $grandTotal = $stores->sum('sales');

        return array_values($stores
            ->groupBy('company')
            ->map(fn (Collection $group, string $company) => [
                'company' => $company,
                'sales' => round($group->sum('sales'), 2),
                'qty' => round($group->sum('qty'), 3),
                'storeCount' => $group->count(),
                'share' => $this->share($group->sum('sales'), $grandTotal),
            ])
            ->sortByDesc('sales')
            ->all());
    }

    /**
     * Every item sold in the period, best sellers first.
     *
     * @param  Builder<DsrLine>  $lines
     * @return list<ItemSales>
     */
    private function byItem(Builder $lines): array
    {
        $totals = $lines->toBase()
            ->selectRaw('article_id, SUM(sales_qty) AS qty, SUM(total_sales) AS sales, COUNT(DISTINCT site_id) AS stores')
            ->groupBy('article_id')
            ->get();

        $articles = Article::whereIn('id', $totals->pluck('article_id'))->get()->keyBy('id');
        $grandTotal = $totals->sum(fn ($row) => (float) $row->sales);

        return array_values($totals
            ->map(function ($row) use ($articles, $grandTotal) {
                $article = $articles[$row->article_id];
                $qty = $this->qty($row->qty);
                $sales = $this->money($row->sales);

                return [
                    'code' => $article->code,
                    'description' => $article->description,
                    'uom' => $article->uom,
                    'qty' => $qty,
                    'sales' => $sales,
                    'share' => $this->share($sales, $grandTotal),
                    'averagePrice' => $qty != 0.0 ? round($sales / $qty, 2) : 0.0,
                    'storeCount' => (int) $row->stores,
                ];
            })
            ->sortByDesc('sales')
            ->all());
    }

    /**
     * Sales per day (or per month for long periods), with empty days filled
     * in so the chart shows gaps instead of hiding them. Days after today are
     * left out, so a current month does not look like sales dropped to zero.
     *
     * @param  Builder<DsrLine>  $lines
     * @return array<string, mixed>
     */
    private function trend(Builder $lines, ReportPeriod $period): array
    {
        $byMonth = $period->groupsTrendByMonth();
        $format = $byMonth ? 'Y-m' : 'Y-m-d';

        $totals = $lines->toBase()
            ->selectRaw('transaction_date, SUM(total_sales) AS sales, SUM(sales_qty) AS qty')
            ->groupBy('transaction_date')
            ->get()
            ->groupBy(fn ($row) => CarbonImmutable::parse($row->transaction_date)->format($format));

        $points = [];
        $cursor = $byMonth ? $period->start->startOfMonth() : $period->start;
        $last = $period->end->min(CarbonImmutable::today());

        while ($cursor->lessThanOrEqualTo($last)) {
            $key = $cursor->format($format);
            $rows = $totals->get($key, collect());

            $points[] = [
                'date' => $key,
                'sales' => round($rows->sum(fn ($row) => (float) $row->sales), 2),
                'qty' => round($rows->sum(fn ($row) => (float) $row->qty), 3),
            ];

            $cursor = $byMonth ? $cursor->addMonth() : $cursor->addDay();
        }

        return ['grouping' => $byMonth ? 'month' : 'day', 'points' => $points];
    }

    private function money(mixed $value): float
    {
        return round((float) $value, 2);
    }

    private function qty(mixed $value): float
    {
        return round((float) $value, 3);
    }

    private function share(float $part, float $total): float
    {
        return $total > 0 ? round($part / $total * 100, 2) : 0.0;
    }
}
