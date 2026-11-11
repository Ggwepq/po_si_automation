<?php

namespace App\Http\Requests\Sales;

use App\Domains\Sales\Data\DsrReportData;
use Illuminate\Foundation\Http\FormRequest;

/**
 * DSR rows parsed from an exported file in the browser. Large files are sent
 * in batches, so each request stays small and quick to validate.
 */
class ImportDsrRequest extends FormRequest
{
    public const MAX_REPORTS = 300;

    public const MAX_LINES = 2000;

    /** Plain decimal numbers only (no exponents), so money adds up exactly. */
    private const DECIMAL = 'regex:/^-?\d{1,12}(\.\d{1,4})?$/';

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'file_name' => ['required', 'string', 'max:255'],
            'reports' => ['required', 'array', 'min:1', 'max:'.self::MAX_REPORTS],
            'reports.*.vendor_code' => ['required', 'string', 'max:20'],
            'reports.*.vendor_name' => ['required', 'string', 'max:255'],
            'reports.*.site_code' => ['required', 'string', 'max:20'],
            'reports.*.site_name' => ['required', 'string', 'max:255'],
            'reports.*.company' => ['required', 'string', 'max:100'],
            'reports.*.transaction_date' => ['required', 'date_format:Y-m-d', 'before_or_equal:today'],
            'reports.*.data_status' => ['nullable', 'string', 'max:30'],
            'reports.*.lines' => ['required', 'array', 'min:1', 'max:'.self::MAX_LINES],
            'reports.*.lines.*.article_code' => ['required', 'string', 'max:30'],
            'reports.*.lines.*.description' => ['required', 'string', 'max:255'],
            'reports.*.lines.*.barcode' => ['nullable', 'string', 'max:30'],
            'reports.*.lines.*.uom' => ['nullable', 'string', 'max:10'],
            'reports.*.lines.*.sales_qty' => ['required', 'string', self::DECIMAL],
            'reports.*.lines.*.vat_exempt_sales' => ['required', 'string', self::DECIMAL],
            'reports.*.lines.*.vatable_sales' => ['required', 'string', self::DECIMAL],
            'reports.*.lines.*.total_sales' => ['required', 'string', self::DECIMAL],
        ];
    }

    /** @return list<DsrReportData> */
    public function reports(): array
    {
        /** @var list<array<string, mixed>> $reports */
        $reports = $this->validated('reports');

        return array_map(DsrReportData::fromArray(...), $reports);
    }
}
