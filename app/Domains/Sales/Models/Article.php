<?php

namespace App\Domains\Sales\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * A product, identified by SM's article code.
 *
 * @property int $id
 * @property string $code
 * @property string $description
 * @property string|null $barcode
 * @property string|null $uom
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['code', 'description', 'barcode', 'uom'])]
class Article extends Model {}
