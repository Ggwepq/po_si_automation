<?php

namespace App\Domains\Sales\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Money received from SM for a liquidation (e.g. one check), as entered by the accountant.
 *
 * @property int $id
 * @property int $liquidation_id
 * @property Carbon $paid_on
 * @property string|null $reference
 * @property string $amount
 * @property int|null $user_id
 * @property Carbon|null $created_at
 */
#[Fillable(['liquidation_id', 'paid_on', 'reference', 'amount', 'user_id'])]
class LiquidationPayment extends Model
{
    /** @return BelongsTo<Liquidation, $this> */
    public function liquidation(): BelongsTo
    {
        return $this->belongsTo(Liquidation::class);
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    protected function casts(): array
    {
        return [
            'paid_on' => 'date',
            'amount' => 'decimal:2',
        ];
    }
}
