<?php

namespace App\Domains\Sales\Actions;

use App\Domains\Sales\Data\ReportFilter;
use App\Domains\Sales\Data\ReportPeriod;
use App\Domains\Sales\Models\Article;
use App\Domains\Sales\Models\DsrLine;
use App\Domains\Sales\Models\Site;
use App\Domains\Sales\Support\SalesReportCache;
use App\Domains\Sales\Support\SalesScope;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

/**
 * Quantity and sales per item for every day (or month, for long periods) and
 * for every store: the grids of the accountants' monthly sales status
 * reports, built from the imported DSRs instead of typed in.
 *
 * Every day of the period is listed, with zeros where nothing sold, so a
 * month always has the same rows. Items follow SM's article codes, which
 * keeps related products together (e.g. hot and iced of the same drink).
 *
 * @phpstan-type MatrixRow array{qty: array<int, float>, sales: array<int, float>}
 */
class BuildSalesMatrix
{
    public function __construct(private SalesReportCache $cache) {}

    /** @return array<string, mixed> */
    public function handle(ReportPeriod $period, ReportFilter $filter): array
    {
        return $this->cache->remember([
            'matrix' => true,
            'start' => $period->start->toDateString(),
            'end' => $period->end->toDateString(),
            ...$filter->cacheKey(),
        ], fn () => $this->build($period, $filter));
    }

    /** @return array<string, mixed> */
    private function build(ReportPeriod $period, ReportFilter $filter): array
    {
        $byMonth = $period->groupsTrendByMonth();
        $lines = fn () => SalesScope::apply(DsrLine::query(), $filter, $period->start, $period->end)->toBase();

        $byDay = $lines()
            ->selectRaw('transaction_date, article_id, SUM(sales_qty) AS qty, SUM(total_sales) AS sales')
            ->groupBy('transaction_date', 'article_id')
            ->get();
        $bySite = $lines()
            ->selectRaw('site_id, article_id, SUM(sales_qty) AS qty, SUM(total_sales) AS sales')
            ->groupBy('site_id', 'article_id')
            ->get();

        $articles = Article::whereIn('id', $byDay->pluck('article_id')->unique())
            ->get(['id', 'code', 'description', 'uom'])
            ->sortBy('code', SORT_NATURAL)
            ->values();
        $column = $articles->pluck('id')->flip();

        $format = $byMonth ? 'Y-m' : 'Y-m-d';
        $dates = $this->rows(
            $byDay->groupBy(fn ($row) => CarbonImmutable::parse($row->transaction_date)->format($format)),
            $column,
        );

        $sites = Site::whereIn('id', $bySite->pluck('site_id')->unique())
            ->orderBy('company')
            ->orderBy('name')
            ->get(['id', 'code', 'name', 'company']);
        $stores = $this->rows($bySite->groupBy('site_id'), $column);

        return [
            'grouping' => $byMonth ? 'month' : 'day',
            'items' => $articles->map(fn (Article $a) => ['code' => $a->code, 'description' => $a->description, 'uom' => $a->uom])->all(),
            'byDate' => array_map(
                fn (string $key) => ['date' => $key, ...($dates[$key] ?? $this->emptyRow($articles->count()))],
                $this->periodKeys($period, $byMonth),
            ),
            'byStore' => $sites->map(fn (Site $site) => [
                'code' => $site->code,
                'name' => $site->name,
                'company' => $site->company,
                ...$stores[$site->id],
            ])->values()->all(),
        ];
    }

    /**
     * @param  Collection<array-key, Collection<int, \stdClass>>  $groups
     * @param  Collection<int, int>  $column  item position by article id
     * @return array<array-key, MatrixRow>
     */
    private function rows(Collection $groups, Collection $column): array
    {
        return $groups->map(function (Collection $cells) use ($column) {
            $row = $this->emptyRow($column->count());

            foreach ($cells as $cell) {
                $i = (int) $column[$cell->article_id];
                $row['qty'][$i] = round($row['qty'][$i] + (float) $cell->qty, 3);
                $row['sales'][$i] = round($row['sales'][$i] + (float) $cell->sales, 2);
            }

            return $row;
        })->all();
    }

    /** @return MatrixRow */
    private function emptyRow(int $items): array
    {
        $zeros = array_fill(0, $items, 0.0);

        return ['qty' => $zeros, 'sales' => $zeros];
    }

    /** @return list<string> every day (or month) of the period */
    private function periodKeys(ReportPeriod $period, bool $byMonth): array
    {
        $keys = [];
        $cursor = $byMonth ? $period->start->startOfMonth() : $period->start;

        while ($cursor->lessThanOrEqualTo($period->end)) {
            $keys[] = $cursor->format($byMonth ? 'Y-m' : 'Y-m-d');
            $cursor = $byMonth ? $cursor->addMonth() : $cursor->addDay();
        }

        return $keys;
    }
}
