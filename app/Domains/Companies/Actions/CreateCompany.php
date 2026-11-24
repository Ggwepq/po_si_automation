<?php

namespace App\Domains\Companies\Actions;

use App\Domains\Companies\Models\Company;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Str;

/** Adds a company, with an optional logo saved on the public disk. */
class CreateCompany
{
    public function handle(string $name, ?UploadedFile $logo = null): Company
    {
        $slug = $this->uniqueSlug($name);
        $logoPath = $logo?->storePubliclyAs('company-logos', $slug.'-'.Str::lower(Str::random(6)).'.'.$logo->extension(), 'public');

        return Company::create([
            'name' => trim($name),
            'slug' => $slug,
            // Served through the public/storage link (php artisan storage:link).
            'logo_path' => is_string($logoPath) ? 'storage/'.$logoPath : null,
        ]);
    }

    /** "Herbs & Fruits" -> herbs-fruits; a taken slug gets -2, -3, ... */
    private function uniqueSlug(string $name): string
    {
        $base = Str::slug($name) ?: 'company';
        $slug = $base;

        for ($i = 2; Company::where('slug', $slug)->exists(); $i++) {
            $slug = $base.'-'.$i;
        }

        return $slug;
    }
}
