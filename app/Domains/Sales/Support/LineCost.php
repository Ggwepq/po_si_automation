<?php

namespace App\Domains\Sales\Support;

/**
 * SQL for the cost of dsr_lines rows: each line takes the unit cost in effect
 * on its transaction date (the latest product_costs entry on or before it).
 * Lines of items without a cost give NULL, so they are left out of cost
 * totals rather than counted as free.
 */
final class LineCost
{
    /** Unit cost of the current dsr_lines row, or NULL. */
    public const UNIT = '(SELECT pc.unit_cost FROM product_costs pc'
        .' WHERE pc.company_id = dsr_lines.company_id AND pc.article_id = dsr_lines.article_id'
        .' AND pc.effective_from <= dsr_lines.transaction_date'
        .' ORDER BY pc.effective_from DESC LIMIT 1)';

    /** "cost" (total cost of costed lines) and "costed_sales" (their sales) for a SELECT. */
    public const COLUMNS = 'SUM(dsr_lines.sales_qty * '.self::UNIT.') AS cost, '
        .'SUM(CASE WHEN '.self::UNIT.' IS NULL THEN 0 ELSE dsr_lines.total_sales END) AS costed_sales';

    /**
     * Gross profit and margin from a row with cost and costed_sales; null
     * when none of its sales has a cost yet.
     *
     * @return array{grossProfit: float|null, grossMargin: float|null, costCoverage: float}
     */
    public static function profit(mixed $cost, mixed $costedSales, float $sales): array
    {
        $costed = round((float) $costedSales, 2);

        if ($cost === null || $costed == 0.0) {
            return ['grossProfit' => null, 'grossMargin' => null, 'costCoverage' => 0.0];
        }

        $profit = round($costed - (float) $cost, 2);

        return [
            'grossProfit' => $profit,
            'grossMargin' => round($profit / $costed * 100, 2),
            // Share of sales whose item has a cost; below 100 the profit is partial.
            'costCoverage' => $sales > 0 ? round(min($costed / $sales, 1) * 100, 2) : 0.0,
        ];
    }
}
