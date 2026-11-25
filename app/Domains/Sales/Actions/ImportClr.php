<?php

namespace App\Domains\Sales\Actions;

use App\Domains\Companies\Models\Company;
use App\Domains\Sales\Data\LiquidationData;
use App\Domains\Sales\Enums\ImportKind;
use App\Domains\Sales\Models\DsrImport;
use App\Domains\Sales\Models\Liquidation;
use App\Domains\Sales\Models\LiquidationStore;
use App\Domains\Sales\Support\StoreDirectory;
use App\Domains\Sales\Support\VendorGuard;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Saves SM's Consolidated Liquidation Report: per chain head office and
 * half-month, the amount payable, withholding tax and net due, with each
 * store's sales. Re-importing a period updates it and keeps the payments
 * already recorded against it.
 */
class ImportClr
{
    public function __construct(private StoreDirectory $stores) {}

    /** @param list<LiquidationData> $liquidations */
    public function handle(Company $company, array $liquidations, string $fileName, ?User $user): DsrImport
    {
        $duplicates = collect($liquidations)->countBy(fn (LiquidationData $l) => $l->key())->filter(fn (int $n) => $n > 1)->keys();

        if ($duplicates->isNotEmpty()) {
            throw ValidationException::withMessages(['liquidations' => 'The file has the same head office and period more than once: '.$duplicates->implode(', ').'.']);
        }

        VendorGuard::check($company, array_map(fn (LiquidationData $l) => $l->vendorCode, $liquidations), 'liquidations');

        return DB::transaction(function () use ($company, $liquidations, $fileName, $user): DsrImport {
            $vendorIds = $this->stores->vendorIds(array_map(fn (LiquidationData $l) => ['code' => $l->vendorCode, 'name' => $l->vendorName], $liquidations));
            $siteIds = $this->stores->siteIds(
                collect($liquidations)->flatMap(fn (LiquidationData $l) => array_map(
                    fn (array $s) => ['code' => $s['site_code'], 'name' => $s['site_name'], 'company' => $s['company']],
                    $l->stores,
                )),
                updateNames: false,
            );

            $import = DsrImport::create([
                'company_id' => $company->id,
                'user_id' => $user?->id,
                'file_name' => $fileName,
                'kind' => ImportKind::Clr,
                'report_count' => count($liquidations),
                'line_count' => array_sum(array_map(fn (LiquidationData $l) => count($l->stores), $liquidations)),
                'replaced_count' => 0,
                'first_date' => collect($liquidations)->min(fn (LiquidationData $l) => $l->periodStart),
                'last_date' => collect($liquidations)->max(fn (LiquidationData $l) => $l->periodEnd),
            ]);

            $key = fn (int $vendorId, string $center, string $start, string $end) => "{$vendorId}|{$center}|{$start}|{$end}";
            $existing = Liquidation::query()
                ->where('company_id', $company->id)
                ->whereBetween('period_start', [
                    collect($liquidations)->min(fn (LiquidationData $l) => $l->periodStart)?->toDateString(),
                    collect($liquidations)->max(fn (LiquidationData $l) => $l->periodStart)?->toDateString(),
                ])
                ->get(['vendor_id', 'center_code', 'period_start', 'period_end'])
                ->map(fn (Liquidation $l) => $key($l->vendor_id, $l->center_code, $l->period_start->toDateString(), $l->period_end->toDateString()))
                ->flip();
            $now = now();

            // Query builder upsert: dates stay plain Y-m-d (the date cast would add a time),
            // and an existing period keeps its id, so its recorded payments stay attached.
            Liquidation::query()->upsert(array_map(fn (LiquidationData $l) => [
                'company_id' => $company->id,
                'vendor_id' => $vendorIds[$l->vendorCode],
                'center_code' => $l->centerCode,
                'center_name' => $l->centerName,
                'chain' => $l->chain,
                'payment_term' => $l->paymentTerm,
                'period_start' => $l->periodStart->toDateString(),
                'period_end' => $l->periodEnd->toDateString(),
                'amount_payable' => $l->amountPayable,
                'ewt' => $l->ewt,
                'net_due' => $l->netDue,
                'dsr_import_id' => $import->id,
                'created_at' => $now,
                'updated_at' => $now,
            ], $liquidations), ['company_id', 'vendor_id', 'center_code', 'period_start', 'period_end'], [
                'center_name', 'chain', 'payment_term', 'amount_payable', 'ewt', 'net_due', 'dsr_import_id', 'updated_at',
            ]);

            $replaced = 0;

            foreach ($liquidations as $data) {
                $id = Liquidation::query()->where([
                    'company_id' => $company->id,
                    'vendor_id' => $vendorIds[$data->vendorCode],
                    'center_code' => $data->centerCode,
                    'period_start' => $data->periodStart->toDateString(),
                    'period_end' => $data->periodEnd->toDateString(),
                ])->value('id');
                $replaced += $existing->has($key($vendorIds[$data->vendorCode], $data->centerCode, $data->periodStart->toDateString(), $data->periodEnd->toDateString())) ? 1 : 0;

                LiquidationStore::where('liquidation_id', $id)->delete();
                LiquidationStore::insert(array_map(fn (array $s) => [
                    'liquidation_id' => $id,
                    'site_id' => $siteIds[$s['site_code']],
                    'vat_exempt_sales' => $s['vat_exempt_sales'],
                    'vatable_sales' => $s['vatable_sales'],
                    'vat_amount' => $s['vat_amount'],
                    'total_sales' => $s['total_sales'],
                ], $data->stores));
            }

            $import->update(['replaced_count' => $replaced]);

            return $import;
        });
    }
}
