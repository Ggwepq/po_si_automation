<?php

namespace App\Domains\Sales\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One store's sales within a liquidation.
 *
 * @property int $id
 * @property int $liquidation_id
 * @property int $site_id
 * @property string $vat_exempt_sales
 * @property string $vatable_sales
 * @property string $vat_amount
 * @property string $total_sales
 */
#[Fillable(['liquidation_id', 'site_id', 'vat_exempt_sales', 'vatable_sales', 'vat_amount', 'total_sales'])]
class LiquidationStore extends Model
{
    public $timestamps = false;

    /** @return BelongsTo<Site, $this> */
    public function site(): BelongsTo
    {
        return $this->belongsTo(Site::class);
    }

    protected function casts(): array
    {
        return [
            'vat_exempt_sales' => 'decimal:2',
            'vatable_sales' => 'decimal:2',
            'vat_amount' => 'decimal:2',
            'total_sales' => 'decimal:2',
        ];
    }
}
