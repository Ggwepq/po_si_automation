<?php

namespace App\Domains\Sales\Data;

use App\Domains\Sales\Enums\PeriodType;
use Carbon\CarbonImmutable;

/** An inclusive date range for a sales report, plus how to name and compare it. */
final readonly class ReportPeriod
{
    public function __construct(
        public PeriodType $type,
        public CarbonImmutable $start,
        public CarbonImmutable $end,
    ) {}

    /**
     * The period of the given type containing $date. Weeks run Monday–Sunday.
     * For custom periods, $end closes the range.
     */
    public static function containing(PeriodType $type, CarbonImmutable $date, ?CarbonImmutable $end = null): self
    {
        $date = $date->startOfDay();

        [$start, $finish] = match ($type) {
            PeriodType::Daily => [$date, $date],
            PeriodType::Weekly => [$date->startOfWeek(CarbonImmutable::MONDAY), $date->endOfWeek(CarbonImmutable::SUNDAY)],
            PeriodType::Monthly => [$date->startOfMonth(), $date->endOfMonth()],
            PeriodType::Quarterly => [$date->startOfQuarter(), $date->endOfQuarter()],
            PeriodType::Yearly => [$date->startOfYear(), $date->endOfYear()],
            PeriodType::Custom => $end && $end->lessThan($date) ? [$end, $date] : [$date, $end ?? $date],
        };

        return new self($type, $start->startOfDay(), $finish->startOfDay());
    }

    /** The period immediately before this one, of the same kind and length. */
    public function previous(): self
    {
        if ($this->type === PeriodType::Custom) {
            $days = $this->days();

            return new self($this->type, $this->start->subDays($days), $this->start->subDay());
        }

        return self::containing($this->type, $this->start->subDay());
    }

    /** The period immediately after this one. */
    public function next(): self
    {
        if ($this->type === PeriodType::Custom) {
            $days = $this->days();

            return new self($this->type, $this->end->addDay(), $this->end->addDays($days));
        }

        return self::containing($this->type, $this->end->addDay());
    }

    public function days(): int
    {
        return (int) $this->start->diffInDays($this->end) + 1;
    }

    /** Long periods are charted by month; shorter ones by day. */
    public function groupsTrendByMonth(): bool
    {
        return $this->days() > 92;
    }

    public function label(): string
    {
        return match ($this->type) {
            PeriodType::Daily => $this->start->format('F j, Y'),
            PeriodType::Weekly, PeriodType::Custom => $this->rangeLabel(),
            PeriodType::Monthly => $this->start->format('F Y'),
            PeriodType::Quarterly => 'Q'.$this->start->quarter.' '.$this->start->year,
            PeriodType::Yearly => (string) $this->start->year,
        };
    }

    private function rangeLabel(): string
    {
        if ($this->start->equalTo($this->end)) {
            return $this->start->format('F j, Y');
        }

        $startFormat = $this->start->year === $this->end->year ? 'M j' : 'M j, Y';

        return $this->start->format($startFormat).' – '.$this->end->format('M j, Y');
    }
}
