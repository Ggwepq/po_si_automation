<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\UploadedFile;

class StoreCompanyRequest extends FormRequest
{
    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:100', 'unique:companies,name'],
            // The SM Vendor Portal number, e.g. 150551.
            'account_number' => ['required', 'string', 'max:20', 'regex:/^[A-Za-z0-9-]+$/', 'unique:companies,account_number'],
            // No SVG: it can carry scripts.
            'logo' => ['nullable', 'image', 'mimes:png,jpg,jpeg,webp', 'max:2048'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return ['account_number.regex' => 'Use the vendor number as shown in the SM Vendor Portal (letters, numbers and dashes only).'];
    }

    public function logo(): ?UploadedFile
    {
        $logo = $this->file('logo');

        return $logo instanceof UploadedFile ? $logo : null;
    }
}
