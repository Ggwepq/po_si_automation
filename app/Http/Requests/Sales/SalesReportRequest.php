<?php

namespace App\Http\Requests\Sales;

use App\Domains\Sales\Data\ReportFilter;
use App\Domains\Sales\Data\ReportPeriod;
use App\Domains\Sales\Enums\PeriodType;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SalesReportRequest extends FormRequest
{
    /** Longest custom range, to keep a single report fast. */
    public const MAX_CUSTOM_DAYS = 1100;

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'period' => ['nullable', Rule::enum(PeriodType::class)],
            'date' => ['nullable', 'date_format:Y-m-d'],
            'end' => [
                'nullable',
                'date_format:Y-m-d',
                'required_if:period,custom',
                'after_or_equal:date',
                function (string $attribute, mixed $value, \Closure $fail): void {
                    $start = $this->input('date');

                    if (is_string($value) && is_string($start)
                        && CarbonImmutable::parse($start)->diffInDays(CarbonImmutable::parse($value)) >= self::MAX_CUSTOM_DAYS) {
                        $fail('Choose a custom range of at most three years.');
                    }
                },
            ],
            'vendors' => ['nullable', 'array', 'max:50'],
            'vendors.*' => ['string', 'max:20'],
            'companies' => ['nullable', 'array', 'max:50'],
            'companies.*' => ['string', 'max:100'],
            'sites' => ['nullable', 'array', 'max:500'],
            'sites.*' => ['string', 'max:20'],
        ];
    }

    /** The requested period, defaulting to the month of $fallbackDate. */
    public function period(CarbonImmutable $fallbackDate): ReportPeriod
    {
        $type = PeriodType::tryFrom((string) $this->validated('period')) ?? PeriodType::Monthly;
        $date = $this->validated('date');
        $end = $this->validated('end');

        return ReportPeriod::containing(
            $type,
            is_string($date) ? CarbonImmutable::parse($date) : $fallbackDate,
            is_string($end) ? CarbonImmutable::parse($end) : null,
        );
    }

    public function filter(): ReportFilter
    {
        return new ReportFilter(
            vendorCodes: $this->list('vendors'),
            companies: $this->list('companies'),
            siteCodes: $this->list('sites'),
        );
    }

    /** @return list<string> unique, non-empty values */
    private function list(string $key): array
    {
        $values = $this->validated($key);

        return is_array($values)
            ? array_values(array_unique(array_filter($values, fn (mixed $v) => is_string($v) && $v !== '')))
            : [];
    }
}
