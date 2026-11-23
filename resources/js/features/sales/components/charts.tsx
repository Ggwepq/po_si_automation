import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import {
    formatMoney,
    formatPercent,
    formatQty,
    formatTrendLabel,
} from '../lib/format';
import type { Slice } from '../lib/format';
import { layoutPieCallouts, pieSectorPath } from '../lib/pie-callouts';
import type { TrendPoint } from '../lib/types';

const tooltipStyle = {
    background: 'var(--popover)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    color: 'var(--popover-foreground)',
    fontSize: 12,
};

export function ChartCard({
    title,
    children,
}: {
    title: string;
    children: React.ReactNode;
}) {
    return (
        <section className="grid break-inside-avoid grid-cols-1 gap-3 rounded-xl border bg-card p-4">
            <h3 className="text-sm font-semibold">{title}</h3>
            {children}
        </section>
    );
}

/**
 * Solid pie chart with elbow leader-line callouts (white-ringed anchor dot
 * inside each slice -> angled line -> horizontal line -> bold value and
 * percentage) plus a compact colour key below for slice names.
 */
export function SharePie({
    slices,
    valueFormat = formatMoney,
}: {
    slices: Slice[];
    valueFormat?: (v: number) => string;
}) {
    const callouts = layoutPieCallouts(slices, {
        cx: 240,
        cy: 124,
        radius: 68,
        columnOffset: 118,
        minGap: 32,
        minY: 24,
        maxY: 224,
    });

    if (!callouts.length) {
        return (
            <p className="py-10 text-center text-sm text-muted-foreground">
                No sales in this period.
            </p>
        );
    }

    return (
        <div className="grid gap-3">
            <svg
                viewBox="0 0 480 248"
                role="img"
                aria-label="Sales share pie chart"
                className="mx-auto h-60 w-full max-w-[520px] overflow-visible select-none"
            >
                <g>
                    {callouts.map((c) => (
                        <path
                            key={c.slice.name}
                            d={pieSectorPath(
                                240,
                                124,
                                68,
                                c.startAngle,
                                c.endAngle,
                            )}
                            fill={c.color}
                            stroke="var(--card)"
                            strokeWidth={2}
                            strokeLinejoin="round"
                        >
                            <title>
                                {`${c.slice.name}: ${valueFormat(c.slice.value)} (${formatPercent(c.slice.share)})`}
                            </title>
                        </path>
                    ))}
                </g>

                <g>
                    {callouts.map((c) => {
                        const isRight = c.side === 'right';
                        const textX = c.labelX + (isRight ? 6 : -6);
                        const anchor = isRight ? 'start' : 'end';

                        return (
                            <g key={c.slice.name}>
                                <polyline
                                    points={`${c.anchorX},${c.anchorY} ${c.elbowX},${c.elbowY} ${c.labelX},${c.labelY}`}
                                    fill="none"
                                    stroke="var(--foreground)"
                                    strokeOpacity={0.78}
                                    strokeWidth={1.5}
                                    strokeLinejoin="round"
                                    strokeLinecap="round"
                                />
                                <circle
                                    cx={c.anchorX}
                                    cy={c.anchorY}
                                    r={3.5}
                                    fill="#1e293b"
                                    stroke="#ffffff"
                                    strokeWidth={1.75}
                                />
                                <text
                                    x={textX}
                                    y={c.labelY - 2}
                                    textAnchor={anchor}
                                    className="fill-foreground text-[12px] font-bold tabular-nums"
                                >
                                    {valueFormat(c.slice.value)}
                                </text>
                                <text
                                    x={textX}
                                    y={c.labelY + 12}
                                    textAnchor={anchor}
                                    className="fill-muted-foreground text-[11px] tabular-nums"
                                >
                                    {formatPercent(c.slice.share)}
                                </text>
                            </g>
                        );
                    })}
                </g>
            </svg>

            <ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 border-t pt-2.5 text-xs">
                {callouts.map((c) => (
                    <li
                        key={c.slice.name}
                        className="flex max-w-full min-w-0 items-center gap-1.5"
                    >
                        <span
                            className="size-2.5 shrink-0 rounded-full"
                            style={{ background: c.color }}
                        />
                        <span className="truncate" title={c.slice.name}>
                            {c.slice.name}
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

export function TopItemsBar({
    items,
    measure,
}: {
    items: { name: string; value: number }[];
    measure: 'qty' | 'sales';
}) {
    const format = measure === 'qty' ? formatQty : formatMoney;

    return (
        <div style={{ height: Math.max(160, items.length * 32) }}>
            <ResponsiveContainer>
                <BarChart
                    data={items}
                    layout="vertical"
                    margin={{ left: 8, right: 16 }}
                >
                    <CartesianGrid horizontal={false} stroke="var(--border)" />
                    <XAxis
                        type="number"
                        tickFormatter={(v) =>
                            measure === 'qty'
                                ? formatQty(v)
                                : formatMoney(v).replace('.00', '')
                        }
                        tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                    />
                    <YAxis
                        type="category"
                        dataKey="name"
                        width={170}
                        tick={{ fontSize: 11, fill: 'var(--foreground)' }}
                    />
                    <Tooltip
                        contentStyle={tooltipStyle}
                        cursor={{ fill: 'var(--muted)' }}
                        formatter={(value) => format(Number(value))}
                    />
                    <Bar
                        dataKey="value"
                        name={measure === 'qty' ? 'Qty sold' : 'Sales'}
                        fill="var(--chart-1)"
                        radius={[0, 4, 4, 0]}
                        isAnimationActive={false}
                    />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}

export function SalesTrend({ points }: { points: TrendPoint[] }) {
    return (
        <div className="h-56">
            <ResponsiveContainer>
                <AreaChart data={points} margin={{ left: 8, right: 8 }}>
                    <defs>
                        <linearGradient
                            id="trend-fill"
                            x1="0"
                            x2="0"
                            y1="0"
                            y2="1"
                        >
                            <stop
                                offset="0%"
                                stopColor="var(--chart-1)"
                                stopOpacity={0.35}
                            />
                            <stop
                                offset="100%"
                                stopColor="var(--chart-1)"
                                stopOpacity={0.02}
                            />
                        </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="var(--border)" />
                    <XAxis
                        dataKey="date"
                        tickFormatter={formatTrendLabel}
                        tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                        minTickGap={16}
                    />
                    <YAxis
                        width={80}
                        tickFormatter={(v) => formatMoney(v).replace('.00', '')}
                        tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                    />
                    <Tooltip
                        contentStyle={tooltipStyle}
                        labelFormatter={(label) =>
                            typeof label === 'string'
                                ? formatTrendLabel(label)
                                : ''
                        }
                        formatter={(value, name) =>
                            name === 'Sales'
                                ? formatMoney(Number(value))
                                : formatQty(Number(value))
                        }
                    />
                    <Area
                        type="monotone"
                        dataKey="sales"
                        name="Sales"
                        stroke="var(--chart-1)"
                        strokeWidth={2}
                        fill="url(#trend-fill)"
                        isAnimationActive={false}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
