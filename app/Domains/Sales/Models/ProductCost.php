<?php

namespace App\Domains\Sales\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * A company's cost for one unit of an item, from `effective_from` until the
 * next entry for the same item. Used to work out gross profit on sales.
 *
 * @property int $id
 * @property int $company_id
 * @property int $article_id
 * @property string $unit_cost
 * @property Carbon $effective_from
 * @property int|null $user_id
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['company_id', 'article_id', 'unit_cost', 'effective_from', 'user_id'])]
class ProductCost extends Model
{
    /** @return BelongsTo<Article, $this> */
    public function article(): BelongsTo
    {
        return $this->belongsTo(Article::class);
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    protected function casts(): array
    {
        return [
            'unit_cost' => 'decimal:4',
            'effective_from' => 'date',
        ];
    }
}
