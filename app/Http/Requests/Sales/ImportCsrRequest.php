<?php

namespace App\Http\Requests\Sales;

use App\Domains\Sales\Data\CsrStoreData;
use Illuminate\Foundation\Http\FormRequest;

/** Consolidated Sales Report rows (per store and half-month, with items) parsed in the browser. */
class ImportCsrRequest extends FormRequest
{
    public const MAX_STORES = 300;

    public const MAX_LINES = 2000;

    private const DECIMAL = 'regex:/^-?\d{1,12}(\.\d{1,4})?$/';

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'file_name' => ['required', 'string', 'max:255'],
            'stores' => ['required', 'array', 'min:1', 'max:'.self::MAX_STORES],
            'stores.*.vendor_code' => ['required', 'string', 'max:20'],
            'stores.*.vendor_name' => ['required', 'string', 'max:255'],
            'stores.*.site_code' => ['required', 'string', 'max:20'],
            'stores.*.site_name' => ['required', 'string', 'max:255'],
            'stores.*.company' => ['required', 'string', 'max:100'],
            'stores.*.period_start' => ['required', 'date_format:Y-m-d'],
            'stores.*.period_end' => ['required', 'date_format:Y-m-d', 'after_or_equal:stores.*.period_start'],
            'stores.*.lines' => ['required', 'array', 'min:1', 'max:'.self::MAX_LINES],
            'stores.*.lines.*.article_code' => ['required', 'string', 'max:30'],
            'stores.*.lines.*.description' => ['required', 'string', 'max:255'],
            'stores.*.lines.*.barcode' => ['nullable', 'string', 'max:30'],
            'stores.*.lines.*.uom' => ['nullable', 'string', 'max:10'],
            'stores.*.lines.*.sales_qty' => ['required', 'string', self::DECIMAL],
            'stores.*.lines.*.vat_exempt_sales' => ['required', 'string', self::DECIMAL],
            'stores.*.lines.*.vatable_sales' => ['required', 'string', self::DECIMAL],
            'stores.*.lines.*.total_sales' => ['required', 'string', self::DECIMAL],
        ];
    }

    /** @return list<CsrStoreData> */
    public function stores(): array
    {
        /** @var list<array<string, mixed>> $stores */
        $stores = $this->validated('stores');

        return array_map(CsrStoreData::fromArray(...), $stores);
    }
}
