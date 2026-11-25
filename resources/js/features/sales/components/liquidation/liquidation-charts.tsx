import {
    Bar,
    BarChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { formatMoney } from '../../lib/format';
import {
    liquidationByChain,
    liquidationByPeriod,
    liquidationByStore,
} from '../../lib/liquidation';
import type { LiquidationPeriodPoint } from '../../lib/liquidation';
import type { Liquidation } from '../../lib/types';
import { ChartCard, SharePie } from '../charts';

const tooltipStyle = {
    background: 'var(--popover)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    color: 'var(--popover-foreground)',
    fontSize: 12,
};

const RECEIVED_COLOR = '#0d9488';
const OUTSTANDING_COLOR = '#ca9a1c';

function PeriodSettlementChart({
    periods,
}: {
    periods: LiquidationPeriodPoint[];
}) {
    if (!periods.length) {
        return (
            <p className="py-10 text-center text-sm text-muted-foreground">
                No liquidations in this period.
            </p>
        );
    }

    return (
        <div className="grid gap-3">
            <div className="h-56">
                <ResponsiveContainer>
                    <BarChart
                        data={periods}
                        margin={{ left: 4, right: 8, top: 4 }}
                    >
                        <CartesianGrid
                            vertical={false}
                            stroke="var(--border)"
                        />
                        <XAxis
                            dataKey="label"
                            tick={{
                                fontSize: 11,
                                fill: 'var(--muted-foreground)',
                            }}
                            minTickGap={12}
                        />
                        <YAxis
                            width={76}
                            tickFormatter={(v) =>
                                formatMoney(Number(v)).replace('.00', '')
                            }
                            tick={{
                                fontSize: 11,
                                fill: 'var(--muted-foreground)',
                            }}
                        />
                        <Tooltip
                            contentStyle={tooltipStyle}
                            cursor={{ fill: 'var(--muted)' }}
                            formatter={(value, name) => [
                                formatMoney(Number(value)),
                                String(name),
                            ]}
                        />
                        <Bar
                            dataKey="paid"
                            name="Received"
                            stackId="settlement"
                            fill={RECEIVED_COLOR}
                            radius={[0, 0, 0, 0]}
                            isAnimationActive={false}
                        />
                        <Bar
                            dataKey="outstanding"
                            name="Still to receive"
                            stackId="settlement"
                            fill={OUTSTANDING_COLOR}
                            radius={[4, 4, 0, 0]}
                            isAnimationActive={false}
                        />
                    </BarChart>
                </ResponsiveContainer>
            </div>
            <ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 border-t pt-2.5 text-xs">
                <li className="flex items-center gap-1.5">
                    <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ background: RECEIVED_COLOR }}
                    />
                    <span>Received</span>
                </li>
                <li className="flex items-center gap-1.5">
                    <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ background: OUTSTANDING_COLOR }}
                    />
                    <span>Still to receive</span>
                </li>
            </ul>
        </div>
    );
}

/** Visual breakdown of the selected year's liquidations: settlements by half-month, share by chain, and share by store. */
export function LiquidationCharts({
    liquidations,
}: {
    liquidations: Liquidation[];
}) {
    const periods = liquidationByPeriod(liquidations);
    const byChain = liquidationByChain(liquidations);
    const byStore = liquidationByStore(liquidations);

    return (
        <section
            aria-label="Liquidation charts"
            className="grid grid-cols-1 gap-4 lg:grid-cols-3"
        >
            <ChartCard title="Half-month settlements (received vs still to receive)">
                <PeriodSettlementChart periods={periods} />
            </ChartCard>
            <ChartCard title="Net amount due by chain">
                <SharePie slices={byChain} />
            </ChartCard>
            <ChartCard title="Liquidated sales by store">
                <SharePie slices={byStore} />
            </ChartCard>
        </section>
    );
}
