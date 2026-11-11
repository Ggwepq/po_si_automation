<?php

namespace App\Domains\Sales\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * One DSR upload, kept as an audit trail.
 *
 * @property int $id
 * @property int|null $user_id
 * @property string $file_name
 * @property int $report_count
 * @property int $line_count
 * @property int $replaced_count
 * @property Carbon|null $first_date
 * @property Carbon|null $last_date
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['user_id', 'file_name', 'report_count', 'line_count', 'replaced_count', 'first_date', 'last_date'])]
class DsrImport extends Model
{
    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    protected function casts(): array
    {
        return [
            'first_date' => 'date',
            'last_date' => 'date',
        ];
    }
}
