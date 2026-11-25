<?php

namespace App\Http\Requests\Sales;

use App\Domains\Sales\Data\LiquidationData;
use Illuminate\Foundation\Http\FormRequest;

/** Consolidated Liquidation Report rows (per chain head office and half-month, with stores) parsed in the browser. */
class ImportClrRequest extends FormRequest
{
    public const MAX_LIQUIDATIONS = 500;

    private const DECIMAL = 'regex:/^-?\d{1,12}(\.\d{1,4})?$/';

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'file_name' => ['required', 'string', 'max:255'],
            'liquidations' => ['required', 'array', 'min:1', 'max:'.self::MAX_LIQUIDATIONS],
            'liquidations.*.vendor_code' => ['required', 'string', 'max:20'],
            'liquidations.*.vendor_name' => ['required', 'string', 'max:255'],
            'liquidations.*.center_code' => ['required', 'string', 'max:20'],
            'liquidations.*.center_name' => ['required', 'string', 'max:255'],
            'liquidations.*.chain' => ['required', 'string', 'max:50'],
            'liquidations.*.payment_term' => ['nullable', 'string', 'max:20'],
            'liquidations.*.period_start' => ['required', 'date_format:Y-m-d'],
            'liquidations.*.period_end' => ['required', 'date_format:Y-m-d', 'after_or_equal:liquidations.*.period_start'],
            'liquidations.*.amount_payable' => ['required', 'string', self::DECIMAL],
            'liquidations.*.ewt' => ['required', 'string', self::DECIMAL],
            'liquidations.*.net_due' => ['required', 'string', self::DECIMAL],
            'liquidations.*.stores' => ['required', 'array', 'min:1', 'max:500'],
            'liquidations.*.stores.*.site_code' => ['required', 'string', 'max:20'],
            'liquidations.*.stores.*.site_name' => ['required', 'string', 'max:255'],
            'liquidations.*.stores.*.company' => ['required', 'string', 'max:100'],
            'liquidations.*.stores.*.vat_exempt_sales' => ['required', 'string', self::DECIMAL],
            'liquidations.*.stores.*.vatable_sales' => ['required', 'string', self::DECIMAL],
            'liquidations.*.stores.*.vat_amount' => ['required', 'string', self::DECIMAL],
            'liquidations.*.stores.*.total_sales' => ['required', 'string', self::DECIMAL],
        ];
    }

    /** @return list<LiquidationData> */
    public function liquidations(): array
    {
        /** @var list<array<string, mixed>> $rows */
        $rows = $this->validated('liquidations');

        return array_map(LiquidationData::fromArray(...), $rows);
    }
}
