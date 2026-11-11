<?php

namespace App\Domains\Sales\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * A DSR document: one store's sales for one day.
 *
 * @property int $id
 * @property int $vendor_id
 * @property int $site_id
 * @property Carbon $transaction_date
 * @property string|null $data_status
 * @property int $article_count
 * @property string $total_qty
 * @property string $total_sales
 * @property int|null $dsr_import_id
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['vendor_id', 'site_id', 'transaction_date', 'data_status', 'article_count', 'total_qty', 'total_sales', 'dsr_import_id'])]
class DsrReport extends Model
{
    /** @return BelongsTo<Vendor, $this> */
    public function vendor(): BelongsTo
    {
        return $this->belongsTo(Vendor::class);
    }

    /** @return BelongsTo<Site, $this> */
    public function site(): BelongsTo
    {
        return $this->belongsTo(Site::class);
    }

    /** @return HasMany<DsrLine, $this> */
    public function lines(): HasMany
    {
        return $this->hasMany(DsrLine::class);
    }

    protected function casts(): array
    {
        return [
            'transaction_date' => 'date',
            'total_qty' => 'decimal:3',
            'total_sales' => 'decimal:2',
        ];
    }
}
