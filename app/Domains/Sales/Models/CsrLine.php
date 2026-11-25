<?php

namespace App\Domains\Sales\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * SM's sales of one item at one store for a half-month ("Consolidated Sales Report").
 * Used to check the DSRs; never counted as sales itself.
 *
 * @property int $id
 * @property int $company_id
 * @property int $vendor_id
 * @property int $site_id
 * @property int $article_id
 * @property Carbon $period_start
 * @property Carbon $period_end
 * @property string $sales_qty
 * @property string $vat_exempt_sales
 * @property string $vatable_sales
 * @property string $total_sales
 * @property int|null $dsr_import_id
 */
#[Fillable(['company_id', 'vendor_id', 'site_id', 'article_id', 'period_start', 'period_end', 'sales_qty', 'vat_exempt_sales', 'vatable_sales', 'total_sales', 'dsr_import_id'])]
class CsrLine extends Model
{
    /** @return BelongsTo<Article, $this> */
    public function article(): BelongsTo
    {
        return $this->belongsTo(Article::class);
    }

    /** @return BelongsTo<Site, $this> */
    public function site(): BelongsTo
    {
        return $this->belongsTo(Site::class);
    }

    protected function casts(): array
    {
        return [
            'period_start' => 'date',
            'period_end' => 'date',
            'sales_qty' => 'decimal:3',
            'vat_exempt_sales' => 'decimal:2',
            'vatable_sales' => 'decimal:2',
            'total_sales' => 'decimal:2',
        ];
    }
}
