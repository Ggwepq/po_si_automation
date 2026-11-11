<?php

use App\Domains\Sales\Data\ReportPeriod;
use App\Domains\Sales\Enums\PeriodType;
use Carbon\CarbonImmutable;

function period(PeriodType $type, string $date, ?string $end = null): ReportPeriod
{
    return ReportPeriod::containing($type, CarbonImmutable::parse($date), $end ? CarbonImmutable::parse($end) : null);
}

it('builds the range containing a date', function (PeriodType $type, string $start, string $end, string $label) {
    $period = period($type, '2026-11-11');

    expect($period->start->toDateString())->toBe($start)
        ->and($period->end->toDateString())->toBe($end)
        ->and($period->label())->toBe($label);
})->with([
    'daily' => [PeriodType::Daily, '2026-11-11', '2026-11-11', 'November 11, 2026'],
    'weekly (Mon–Sun)' => [PeriodType::Weekly, '2026-11-09', '2026-11-15', 'Nov 9 – Nov 15, 2026'],
    'monthly' => [PeriodType::Monthly, '2026-11-01', '2026-11-30', 'November 2026'],
    'quarterly' => [PeriodType::Quarterly, '2026-10-01', '2026-12-31', 'Q4 2026'],
    'yearly' => [PeriodType::Yearly, '2026-01-01', '2026-12-31', '2026'],
]);

it('steps to the previous and next period', function () {
    $month = period(PeriodType::Monthly, '2026-03-15');

    expect($month->previous()->start->toDateString())->toBe('2026-02-01')
        ->and($month->previous()->end->toDateString())->toBe('2026-02-28')
        ->and($month->next()->start->toDateString())->toBe('2026-04-01');
});

it('compares a custom range with the same number of days before it', function () {
    $range = period(PeriodType::Custom, '2026-11-10', '2026-11-16');
    $previous = $range->previous();

    expect($range->days())->toBe(7)
        ->and($previous->start->toDateString())->toBe('2026-11-03')
        ->and($previous->end->toDateString())->toBe('2026-11-09');
});

it('charts long periods by month', function () {
    expect(period(PeriodType::Quarterly, '2026-11-11')->groupsTrendByMonth())->toBeFalse()
        ->and(period(PeriodType::Yearly, '2026-11-11')->groupsTrendByMonth())->toBeTrue();
});
