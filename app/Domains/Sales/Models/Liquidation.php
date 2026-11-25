<?php

namespace App\Domains\Sales\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * What one SM chain head office ("countering center") owes a company for a
 * half-month, from SM's Consolidated Liquidation Report.
 *
 * @property int $id
 * @property int $company_id
 * @property int $vendor_id
 * @property string $center_code
 * @property string $center_name
 * @property string $chain
 * @property string|null $payment_term
 * @property Carbon $period_start
 * @property Carbon $period_end
 * @property string $amount_payable
 * @property string $ewt
 * @property string $net_due
 * @property int|null $dsr_import_id
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['company_id', 'vendor_id', 'center_code', 'center_name', 'chain', 'payment_term', 'period_start', 'period_end', 'amount_payable', 'ewt', 'net_due', 'dsr_import_id'])]
class Liquidation extends Model
{
    /** @return HasMany<LiquidationStore, $this> */
    public function stores(): HasMany
    {
        return $this->hasMany(LiquidationStore::class);
    }

    /** @return HasMany<LiquidationPayment, $this> */
    public function payments(): HasMany
    {
        return $this->hasMany(LiquidationPayment::class);
    }

    /** @return BelongsTo<Vendor, $this> */
    public function vendor(): BelongsTo
    {
        return $this->belongsTo(Vendor::class);
    }

    protected function casts(): array
    {
        return [
            'period_start' => 'date',
            'period_end' => 'date',
            'amount_payable' => 'decimal:2',
            'ewt' => 'decimal:2',
            'net_due' => 'decimal:2',
        ];
    }
}
