<?php

namespace App\Http\Requests\Admin;

use App\Concerns\ProfileValidationRules;
use Illuminate\Foundation\Http\FormRequest;

class StoreCompanyUserRequest extends FormRequest
{
    use ProfileValidationRules;

    /**
     * The admin picks the first password and hands it over, so no strength
     * rules apply here; it only has to be entered twice the same way. Users
     * change it under Settings, where the usual rules apply.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            ...$this->profileRules(),
            'password' => ['required', 'string', 'max:255', 'confirmed'],
        ];
    }
}
