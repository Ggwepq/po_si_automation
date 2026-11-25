<?php

namespace App\Domains\Sales\Actions;

use App\Domains\Sales\Data\ReportFilter;
use App\Domains\Sales\Models\Article;
use App\Domains\Sales\Models\DsrLine;
use App\Domains\Sales\Support\SalesReportCache;
use App\Domains\Sales\Support\SalesScope;
use Carbon\CarbonImmutable;

/**
 * The ModCon (consignment) summary for a year: each item's sales and
 * quantity per SM store chain (SSM, SVI, SMCo) for every half-month
 * (1st–15th and 16th–end), the periods SM is billed for. Days are counted by
 * transaction date.
 *
 * Every chain lists the same items, in SM article-code order, so the
 * workbook's per-chain sheets line up row by row.
 */
class BuildModconSummary
{
    public const HALVES = 24;

    public function __construct(private SalesReportCache $cache) {}

    /** @return array<string, mixed> */
    public function handle(int $year, ReportFilter $filter): array
    {
        return $this->cache->remember([
            'modcon' => true,
            'year' => (string) $year,
            ...$filter->cacheKey(),
        ], fn () => $this->build($year, $filter));
    }

    /** @return array<string, mixed> */
    private function build(int $year, ReportFilter $filter): array
    {
        $start = CarbonImmutable::create($year, 1, 1);
        $end = CarbonImmutable::create($year, 12, 31);

        $rows = SalesScope::apply(DsrLine::query(), $filter, $start, $end)
            ->toBase()
            ->join('sites', 'sites.id', '=', 'dsr_lines.site_id')
            ->selectRaw('sites.company AS chain, dsr_lines.article_id, dsr_lines.transaction_date, '.
                'SUM(dsr_lines.sales_qty) AS qty, SUM(dsr_lines.total_sales) AS sales')
            ->groupBy('sites.company', 'dsr_lines.article_id', 'dsr_lines.transaction_date')
            ->get();

        $articles = Article::whereIn('id', $rows->pluck('article_id')->unique())
            ->get(['id', 'code', 'description'])
            ->sortBy('code', SORT_NATURAL)
            ->values();
        $position = $articles->pluck('id')->flip();
        $empty = array_fill(0, $articles->count(), array_fill(0, self::HALVES, 0.0));

        /** @var array<string, array{amount: list<list<float>>, qty: list<list<float>>}> $chains */
        $chains = [];

        foreach ($rows as $row) {
            $chain = (string) $row->chain;
            $chains[$chain] ??= ['amount' => $empty, 'qty' => $empty];
            $date = CarbonImmutable::parse($row->transaction_date);
            $half = ($date->month - 1) * 2 + ($date->day > 15 ? 1 : 0);
            $i = (int) $position[$row->article_id];

            $chains[$chain]['amount'][$i][$half] = round($chains[$chain]['amount'][$i][$half] + (float) $row->sales, 2);
            $chains[$chain]['qty'][$i][$half] = round($chains[$chain]['qty'][$i][$half] + (float) $row->qty, 3);
        }

        ksort($chains, SORT_NATURAL | SORT_FLAG_CASE);

        return [
            'year' => $year,
            'items' => $articles->map(fn (Article $a) => ['code' => $a->code, 'description' => $a->description])->all(),
            'chains' => array_map(
                fn (string $chain, array $data) => ['chain' => $chain, ...$data],
                array_keys($chains),
                array_values($chains),
            ),
        ];
    }
}
