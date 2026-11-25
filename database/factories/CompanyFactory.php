<?php

namespace Database\Factories;

use App\Domains\Companies\Models\Company;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Company>
 */
class CompanyFactory extends Factory
{
    protected $model = Company::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        $name = fake()->unique()->company();

        return [
            'name' => $name,
            'slug' => Str::slug($name).'-'.Str::lower(Str::random(4)),
            'logo_path' => null,
        ];
    }

    /** Has the PO & SI workflow and RA item matching, like Oroza Enterprise. */
    public function withWorkbookTools(): static
    {
        return $this->state(['workbook_tools' => true]);
    }
}
