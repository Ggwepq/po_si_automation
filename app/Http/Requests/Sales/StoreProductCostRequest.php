<?php

namespace App\Http\Requests\Sales;

use Carbon\CarbonImmutable;
use Illuminate\Foundation\Http\FormRequest;

class StoreProductCostRequest extends FormRequest
{
    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'article_code' => ['required', 'string', 'max:30', 'exists:articles,code'],
            // Peso amount with up to 4 decimals, e.g. 25.96.
            'unit_cost' => ['required', 'string', 'regex:/^\d{1,8}(\.\d{1,4})?$/'],
            'effective_from' => ['required', 'date_format:Y-m-d'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return ['unit_cost.regex' => 'Enter the cost as a peso amount, e.g. 25.96.'];
    }

    /** @return numeric-string */
    public function unitCost(): string
    {
        /** @var numeric-string */
        return $this->string('unit_cost')->toString();
    }

    public function effectiveFrom(): CarbonImmutable
    {
        return CarbonImmutable::parse($this->string('effective_from')->toString());
    }
}
