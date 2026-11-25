<?php

namespace App\Http\Requests\Sales;

use Carbon\CarbonImmutable;
use Illuminate\Foundation\Http\FormRequest;

class ImportProductCostsRequest extends FormRequest
{
    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'effective_from' => ['required', 'date_format:Y-m-d'],
            'costs' => ['required', 'array', 'min:1', 'max:2000'],
            'costs.*.article_code' => ['required', 'string', 'max:30', 'distinct'],
            'costs.*.unit_cost' => ['required', 'string', 'regex:/^\d{1,8}(\.\d{1,4})?$/'],
        ];
    }

    /** @return array<string, numeric-string> unit cost by article code */
    public function costs(): array
    {
        /** @var list<array{article_code: string, unit_cost: numeric-string}> $costs */
        $costs = $this->validated('costs');

        return array_column($costs, 'unit_cost', 'article_code');
    }

    public function effectiveFrom(): CarbonImmutable
    {
        return CarbonImmutable::parse($this->string('effective_from')->toString());
    }
}
