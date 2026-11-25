<?php

namespace App\Http\Requests\Sales;

use Illuminate\Foundation\Http\FormRequest;

class StoreLiquidationPaymentRequest extends FormRequest
{
    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'paid_on' => ['required', 'date_format:Y-m-d', 'before_or_equal:today'],
            // e.g. the check number from SM's Remittance Advice.
            'reference' => ['nullable', 'string', 'max:100'],
            'amount' => ['required', 'string', 'regex:/^\d{1,12}(\.\d{1,2})?$/', 'not_in:0,0.0,0.00'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return ['amount.regex' => 'Enter the amount received in pesos, e.g. 116123.26.'];
    }
}
