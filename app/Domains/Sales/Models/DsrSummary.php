<?php

namespace App\Domains\Sales\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * SM's official total for a vendor, store and day ("DSR Summary").
 *
 * @property int $id
 * @property int $vendor_id
 * @property int $site_id
 * @property Carbon $transaction_date
 * @property string $total_sales
 * @property int|null $dsr_import_id
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['vendor_id', 'site_id', 'transaction_date', 'total_sales', 'dsr_import_id'])]
class DsrSummary extends Model
{
    /** @return BelongsTo<Site, $this> */
    public function site(): BelongsTo
    {
        return $this->belongsTo(Site::class);
    }

    protected function casts(): array
    {
        return [
            'transaction_date' => 'date',
            'total_sales' => 'decimal:2',
        ];
    }
}
