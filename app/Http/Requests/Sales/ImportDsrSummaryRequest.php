<?php

namespace App\Http\Requests\Sales;

use App\Domains\Sales\Data\DsrSummaryData;
use Illuminate\Foundation\Http\FormRequest;

/** DSR Summary rows (one per store and day) parsed from SM's export in the browser. */
class ImportDsrSummaryRequest extends FormRequest
{
    public const MAX_SUMMARIES = 2000;

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'file_name' => ['required', 'string', 'max:255'],
            'summaries' => ['required', 'array', 'min:1', 'max:'.self::MAX_SUMMARIES],
            'summaries.*.vendor_code' => ['required', 'string', 'max:20'],
            'summaries.*.vendor_name' => ['required', 'string', 'max:255'],
            'summaries.*.site_code' => ['required', 'string', 'max:20'],
            'summaries.*.site_name' => ['required', 'string', 'max:255'],
            'summaries.*.company' => ['required', 'string', 'max:100'],
            'summaries.*.transaction_date' => ['required', 'date_format:Y-m-d', 'before_or_equal:today'],
            'summaries.*.total_sales' => ['required', 'string', 'regex:/^-?\d{1,12}(\.\d{1,4})?$/'],
        ];
    }

    /** @return list<DsrSummaryData> */
    public function summaries(): array
    {
        /** @var list<array<string, mixed>> $summaries */
        $summaries = $this->validated('summaries');

        return array_map(DsrSummaryData::fromArray(...), $summaries);
    }
}
