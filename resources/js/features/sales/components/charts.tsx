import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Pie,
    PieChart,
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
import type { TrendPoint } from '../lib/types';

/** Soft palette built from the theme's chart colours; "Others" stays grey. */
const COLORS = [
    'var(--chart-1)',
    'var(--chart-2)',
    'var(--chart-3)',
    'var(--chart-4)',
    'var(--chart-5)',
    'oklch(0.74 0.07 300)',
];
const OTHERS = 'oklch(0.82 0.01 260)';

const sliceColor = (slice: Slice, index: number) =>
    slice.name === 'Others' ? OTHERS : COLORS[index % COLORS.length];

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

/** Pie with a legend listing each slice's share and amount. */
export function SharePie({
    slices,
    valueFormat = formatMoney,
}: {
    slices: Slice[];
    valueFormat?: (v: number) => string;
}) {
    if (!slices.length) {
        return (
            <p className="py-10 text-center text-sm text-muted-foreground">
                No sales in this period.
            </p>
        );
    }

    return (
        <div className="grid items-center gap-4 sm:grid-cols-[150px_minmax(0,1fr)] print:grid-cols-[150px_minmax(0,1fr)]">
            <div className="h-40">
                <ResponsiveContainer>
                    <PieChart>
                        <Pie
                            data={slices}
                            dataKey="value"
                            nameKey="name"
                            innerRadius="55%"
                            outerRadius="95%"
                            paddingAngle={1}
                            isAnimationActive={false}
                        >
                            {slices.map((slice, index) => (
                                <Cell
                                    key={slice.name}
                                    fill={sliceColor(slice, index)}
                                    stroke="var(--card)"
                                />
                            ))}
                        </Pie>
                        <Tooltip
                            contentStyle={tooltipStyle}
                            formatter={(value) => valueFormat(Number(value))}
                        />
                    </PieChart>
                </ResponsiveContainer>
            </div>
            <ul className="grid min-w-0 gap-1.5 text-sm">
                {slices.map((slice, index) => (
                    <li
                        key={slice.name}
                        className="flex min-w-0 items-center gap-2"
                    >
                        <span
                            className="size-2.5 shrink-0 rounded-full"
                            style={{ background: sliceColor(slice, index) }}
                        />
                        <span
                            className="min-w-0 flex-1 truncate"
                            title={slice.name}
                        >
                            {slice.name}
                        </span>
                        <span className="shrink-0 text-muted-foreground tabular-nums">
                            {formatPercent(slice.share)}
                        </span>
                        <span className="shrink-0 text-right whitespace-nowrap tabular-nums">
                            {valueFormat(slice.value)}
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
