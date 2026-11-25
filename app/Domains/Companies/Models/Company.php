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
 * @property string|null $account_number SM Vendor Portal number, used to log in
 * @property string $slug
 * @property string|null $logo_path
 * @property bool $workbook_tools PO & SI workflow and RA item matching
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['name', 'account_number', 'slug', 'logo_path', 'workbook_tools'])]
class Company extends Model
{
    /** @use HasFactory<CompanyFactory> */
    use HasFactory;

    /** @return array<string, string> */
    protected function casts(): array
    {
        return ['workbook_tools' => 'boolean'];
    }

    /** @return HasMany<User, $this> */
    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    /**
     * Vendor codes this company may import DSRs for: its own account number.
     * A company without one (not set up yet) is not restricted.
     */
    public function ownsVendor(string $vendorCode): bool
    {
        return $this->account_number === null || trim($vendorCode) === $this->account_number;
    }

    public function logoUrl(): ?string
    {
        return $this->logo_path === null ? null : asset($this->logo_path);
    }

    /** @return array{id: int, name: string, accountNumber: string|null, slug: string, logoUrl: string|null, workbookTools: bool} */
    public function toBrand(): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'accountNumber' => $this->account_number,
            'slug' => $this->slug,
            'logoUrl' => $this->logoUrl(),
            'workbookTools' => $this->workbook_tools,
        ];
    }

    protected static function newFactory(): CompanyFactory
    {
        return CompanyFactory::new();
    }
}
