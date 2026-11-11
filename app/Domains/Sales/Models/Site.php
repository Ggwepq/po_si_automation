<?php

namespace App\Domains\Sales\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * An SM store that reports daily sales.
 *
 * @property int $id
 * @property string $code
 * @property string $name
 * @property string $company
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['code', 'name', 'company'])]
class Site extends Model
{
    /** @return HasMany<DsrReport, $this> */
    public function reports(): HasMany
    {
        return $this->hasMany(DsrReport::class);
    }
}
