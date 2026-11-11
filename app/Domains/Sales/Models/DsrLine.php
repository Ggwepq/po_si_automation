<?php

namespace App\Domains\Sales\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * One item line of a DSR. Site and date are copied from the report so that
 * period reports can aggregate this table without joins.
 *
 * @property int $id
 * @property int $dsr_report_id
 * @property int $vendor_id
 * @property int $site_id
 * @property int $article_id
 * @property Carbon $transaction_date
 * @property string $sales_qty
 * @property string $vat_exempt_sales
 * @property string $vatable_sales
 * @property string $total_sales
 */
#[Fillable(['dsr_report_id', 'vendor_id', 'site_id', 'article_id', 'transaction_date', 'sales_qty', 'vat_exempt_sales', 'vatable_sales', 'total_sales'])]
class DsrLine extends Model
{
    public $timestamps = false;

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
            'transaction_date' => 'date',
            'sales_qty' => 'decimal:3',
            'vat_exempt_sales' => 'decimal:2',
            'vatable_sales' => 'decimal:2',
            'total_sales' => 'decimal:2',
        ];
    }
}
