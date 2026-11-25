<?php

namespace App\Domains\Sales\Actions;

use App\Domains\Sales\Models\CsrLine;
use App\Domains\Sales\Models\DsrLine;
use App\Domains\Sales\Models\Liquidation;
use App\Domains\Sales\Models\LiquidationPayment;
use App\Domains\Sales\Models\LiquidationStore;
use Carbon\CarbonImmutable;
use Carbon\CarbonPeriod;
use Illuminate\Support\Collection;

/**
 * SM's liquidations for a company, each checked against what was imported:
 * - DSR check: per store, SM's sales for the period (before VAT) against the
 *   imported DSR lines for the same store and days;
 * - CSR: SM's own item-level total for the store and period, when imported;
 * - payments: what was received, against the net amount due.
 *
 * Amounts within ₱1 count as equal: SM rounds per head office, so its totals
 * can differ from the store sum by a centavo.
 *
 * @phpstan-type Payment array{id: int, paidOn: string, reference: string|null, amount: float, recordedBy: string|null}
 */
class BuildLiquidationReport
{
    public const TOLERANCE = 1.0;

    /** @return list<array<string, mixed>> */
    public function handle(int $companyId): array
    {
        $liquidations = Liquidation::query()
            ->where('company_id', $companyId)
            ->with(['stores.site:id,code,name', 'payments.user:id,name'])
            ->orderByDesc('period_start')
            ->orderBy('chain')
            ->get();

        if ($liquidations->isEmpty()) {
            return [];
        }

        $dsr = $this->dsrSales($companyId, $liquidations);
        $csr = $this->csrSales($companyId, $liquidations);
        $today = CarbonImmutable::today();

        return array_values($liquidations->map(function (Liquidation $l) use ($dsr, $csr, $today) {
            $stores = $l->stores->map(function (LiquidationStore $s) use ($l, $dsr, $csr, $today) {
                $days = $dsr->get("{$l->vendor_id}|{$s->site_id}", collect());
                $sm = (float) $s->vat_exempt_sales + (float) $s->vatable_sales;
                $inPeriod = $days->filter(fn (float $sales, string $date) => $date >= $l->period_start->toDateString() && $date <= $l->period_end->toDateString());
                $dsrSales = round($inPeriod->sum(), 2);
                $last = $l->period_end->min($today);
                $missing = $l->period_start->greaterThan($last) ? [] : array_values(array_filter(
                    array_map(fn ($d) => $d->toDateString(), CarbonPeriod::create($l->period_start, $last)->toArray()),
                    fn (string $date) => ! $inPeriod->has($date),
                ));
                $csrSales = $csr->get("{$l->vendor_id}|{$s->site_id}|{$l->period_start->toDateString()}|{$l->period_end->toDateString()}");

                return [
                    'code' => $s->site->code,
                    'name' => $s->site->name,
                    'smSales' => round($sm, 2),
                    'vat' => (float) $s->vat_amount,
                    'totalSales' => (float) $s->total_sales,
                    'dsrSales' => $dsrSales,
                    'difference' => round($dsrSales - $sm, 2),
                    'missingDays' => $missing,
                    'csrSales' => $csrSales,
                ];
            })->sortBy('code')->values();

            $sales = round($stores->sum('smSales'), 2);
            $dsrSales = round($stores->sum('dsrSales'), 2);
            $paid = round($l->payments->sum(fn (LiquidationPayment $p) => (float) $p->amount), 2);
            $netDue = (float) $l->net_due;

            return [
                'id' => $l->id,
                'periodStart' => $l->period_start->toDateString(),
                'periodEnd' => $l->period_end->toDateString(),
                'centerCode' => $l->center_code,
                'centerName' => $l->center_name,
                'chain' => $l->chain,
                'paymentTerm' => $l->payment_term,
                'sales' => $sales,
                'vat' => round($stores->sum('vat'), 2),
                'amountPayable' => (float) $l->amount_payable,
                'ewt' => (float) $l->ewt,
                'netDue' => $netDue,
                'dsrSales' => $dsrSales,
                'dsrDifference' => round($dsrSales - $sales, 2),
                'dsrMatches' => $stores->every(fn (array $s) => abs($s['difference']) < self::TOLERANCE),
                'csrImported' => $stores->contains(fn (array $s) => $s['csrSales'] !== null),
                'paid' => $paid,
                'balance' => round($netDue - $paid, 2),
                'status' => $this->status($paid, $netDue),
                'payments' => array_values($l->payments->sortBy('paid_on')->map(fn (LiquidationPayment $p) => [
                    'id' => $p->id,
                    'paidOn' => $p->paid_on->toDateString(),
                    'reference' => $p->reference,
                    'amount' => (float) $p->amount,
                    'recordedBy' => $p->user?->name,
                ])->all()),
                'stores' => $stores->all(),
            ];
        })->all());
    }

    private function status(float $paid, float $netDue): string
    {
        return match (true) {
            $paid == 0.0 => 'unpaid',
            abs($paid - $netDue) < self::TOLERANCE => 'paid',
            $paid < $netDue => 'short',
            default => 'over',
        };
    }

    /**
     * DSR sales by vendor and store, then by day.
     *
     * @param  Collection<int, Liquidation>  $liquidations
     * @return Collection<string, Collection<string, float>>
     */
    private function dsrSales(int $companyId, Collection $liquidations): Collection
    {
        return DsrLine::query()
            ->where('company_id', $companyId)
            ->whereBetween('transaction_date', [
                $liquidations->min(fn (Liquidation $l) => $l->period_start)?->toDateString(),
                $liquidations->max(fn (Liquidation $l) => $l->period_end)?->toDateString(),
            ])
            ->toBase()
            ->selectRaw('vendor_id, site_id, transaction_date, SUM(total_sales) AS sales')
            ->groupBy('vendor_id', 'site_id', 'transaction_date')
            ->get()
            ->groupBy(fn ($row) => "{$row->vendor_id}|{$row->site_id}")
            ->map(fn (Collection $rows) => $rows->mapWithKeys(fn ($row) => [
                // Some databases return a datetime string for a date column.
                substr((string) $row->transaction_date, 0, 10) => (float) $row->sales,
            ]));
    }

    /**
     * CSR total by vendor, store and period.
     *
     * @param  Collection<int, Liquidation>  $liquidations
     * @return Collection<string, float>
     */
    private function csrSales(int $companyId, Collection $liquidations): Collection
    {
        return CsrLine::query()
            ->where('company_id', $companyId)
            ->where('period_start', '>=', $liquidations->min(fn (Liquidation $l) => $l->period_start)?->toDateString())
            ->toBase()
            ->selectRaw('vendor_id, site_id, period_start, period_end, SUM(total_sales) AS sales')
            ->groupBy('vendor_id', 'site_id', 'period_start', 'period_end')
            ->get()
            ->mapWithKeys(fn ($row) => [
                "{$row->vendor_id}|{$row->site_id}|".substr((string) $row->period_start, 0, 10).'|'.substr((string) $row->period_end, 0, 10) => round((float) $row->sales, 2),
            ]);
    }
}
