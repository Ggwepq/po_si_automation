<?php

namespace App\Domains\Companies\Models;

use App\Models\User;
use Database\Factories\CompanyFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * A business using the app (e.g. Oroza Enterprise, HnF). Its users and its
 * imported sales are kept apart from every other company's.
 *
 * Not to be confused with the "company" of an SM store (SVI, SMCo, SSM),
 * which is the store chain shown in sales reports.
 *
 * @property int $id
 * @property string $name
 * @property string $slug
 * @property string|null $logo_path
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['name', 'slug', 'logo_path'])]
class Company extends Model
{
    /** @use HasFactory<CompanyFactory> */
    use HasFactory;

    /** @return HasMany<User, $this> */
    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    public function logoUrl(): ?string
    {
        return $this->logo_path === null ? null : asset($this->logo_path);
    }

    /** @return array{id: int, name: string, slug: string, logoUrl: string|null} */
    public function toBrand(): array
    {
        return ['id' => $this->id, 'name' => $this->name, 'slug' => $this->slug, 'logoUrl' => $this->logoUrl()];
    }

    protected static function newFactory(): CompanyFactory
    {
        return CompanyFactory::new();
    }
}
