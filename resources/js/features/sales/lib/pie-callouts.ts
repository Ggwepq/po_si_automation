import type { Slice } from './format';

/**
 * Distinct, high-contrast slice palette matching the management pie-chart
 * reference; "Others" always renders in slate grey.
 */
export const PIE_COLORS = [
    '#1a1888',
    '#0d9488',
    '#ca9a1c',
    '#7c69d6',
    '#dd7555',
    '#2f9e5b',
    '#3b82f6',
];
export const PIE_OTHERS_COLOR = '#64748b';

export const pieSliceColor = (slice: Slice, index: number): string =>
    slice.name === 'Others'
        ? PIE_OTHERS_COLOR
        : PIE_COLORS[index % PIE_COLORS.length];

export type PieCallout = {
    slice: Slice;
    index: number;
    color: string;
    startAngle: number;
    endAngle: number;
    midAngle: number;
    side: 'left' | 'right';
    anchorX: number;
    anchorY: number;
    elbowX: number;
    elbowY: number;
    labelX: number;
    labelY: number;
};

export type PieLayoutGeometry = {
    cx: number;
    cy: number;
    radius: number;
    /** Horizontal distance from cx to the left/right label line ends. */
    columnOffset: number;
    /** Minimum vertical gap between two labels on the same side. */
    minGap: number;
    /** Vertical bounds for label Y coordinates. */
    minY: number;
    maxY: number;
    /** Extra radial distance outside the pie rim for the elbow turn. */
    elbowOffset?: number;
};

/**
 * Computes slice angles and non-overlapping left/right callout leader lines
 * (anchor dot inside the slice -> angled segment -> horizontal segment).
 */
export function layoutPieCallouts(
    slices: Slice[],
    geometry: PieLayoutGeometry,
): PieCallout[] {
    const positive = slices.filter((s) => s.value > 0);

    if (!positive.length) {
        return [];
    }

    const {
        cx,
        cy,
        radius,
        columnOffset,
        minGap,
        minY,
        maxY,
        elbowOffset = radius * 0.22,
    } = geometry;
    const total = positive.reduce((sum, s) => sum + s.value, 0) || 1;
    let angle = -Math.PI / 2;

    const raw = positive.map((slice, index) => {
        const sweep = (slice.value / total) * Math.PI * 2;
        const startAngle = angle;
        const endAngle = angle + sweep;
        const midAngle = startAngle + sweep / 2;
        angle = endAngle;

        const cos = Math.cos(midAngle);
        const sin = Math.sin(midAngle);
        const side: 'left' | 'right' = cos >= -1e-6 ? 'right' : 'left';
        // Narrow wedges place their anchor dot slightly closer to the rim so it stays clear of the apex.
        const anchorRadius =
            positive.length === 1
                ? 0
                : sweep < 0.22
                  ? radius * 0.76
                  : radius * 0.66;
        const anchorX = cx + anchorRadius * cos;
        const anchorY = cy + anchorRadius * sin;
        const naturalY = cy + (radius + elbowOffset) * sin;

        return {
            slice,
            index,
            color: pieSliceColor(slice, index),
            startAngle,
            endAngle,
            midAngle,
            side,
            cos,
            sin,
            anchorX,
            anchorY,
            naturalY,
        };
    });

    const assignSide = (side: 'left' | 'right'): PieCallout[] => {
        const group = raw
            .filter((item) => item.side === side)
            // Sort top-to-bottom in rotational order so leader lines never cross.
            .sort((a, b) =>
                side === 'right'
                    ? a.midAngle - b.midAngle
                    : b.midAngle - a.midAngle,
            );

        if (!group.length) {
            return [];
        }

        const ys = group.map((g) => Math.max(minY, Math.min(maxY, g.naturalY)));

        for (let i = 1; i < ys.length; i++) {
            if (ys[i] < ys[i - 1] + minGap) {
                ys[i] = ys[i - 1] + minGap;
            }
        }

        if (ys[ys.length - 1] > maxY) {
            ys[ys.length - 1] = maxY;

            for (let i = ys.length - 2; i >= 0; i--) {
                if (ys[i] > ys[i + 1] - minGap) {
                    ys[i] = ys[i + 1] - minGap;
                }
            }
        }

        if (ys[0] < minY) {
            ys[0] = minY;

            for (let i = 1; i < ys.length; i++) {
                if (ys[i] < ys[i - 1] + minGap) {
                    ys[i] = ys[i - 1] + minGap;
                }
            }
        }

        const sign = side === 'right' ? 1 : -1;
        const labelX = cx + sign * columnOffset;
        const rimGap = Math.max(columnOffset - radius, 4);
        const minHoriz = Math.min(Math.max(radius * 0.12, 4), rimGap * 0.55);
        const minOutward = Math.max(radius * 0.06, 2);

        return group.map((item, i) => {
            const labelY = ys[i];
            const radialX = cx + (radius + elbowOffset) * item.cos;
            const dy = Math.abs(labelY - item.anchorY);
            const idealElbowX =
                dy > radius * 0.35
                    ? item.anchorX + sign * Math.min(dy * 0.45, radius * 0.45)
                    : radialX;
            const elbowX =
                side === 'right'
                    ? Math.min(
                          labelX - minHoriz,
                          Math.max(item.anchorX + minOutward, idealElbowX),
                      )
                    : Math.max(
                          labelX + minHoriz,
                          Math.min(item.anchorX - minOutward, idealElbowX),
                      );

            return {
                slice: item.slice,
                index: item.index,
                color: item.color,
                startAngle: item.startAngle,
                endAngle: item.endAngle,
                midAngle: item.midAngle,
                side,
                anchorX: item.anchorX,
                anchorY: item.anchorY,
                elbowX,
                elbowY: labelY,
                labelX,
                labelY,
            };
        });
    };

    return [...assignSide('right'), ...assignSide('left')].sort(
        (a, b) => a.index - b.index,
    );
}

/** Builds an SVG path string for a solid pie sector (or full circle when 100%). */
export function pieSectorPath(
    cx: number,
    cy: number,
    radius: number,
    startAngle: number,
    endAngle: number,
): string {
    const sweep = endAngle - startAngle;

    if (sweep >= Math.PI * 2 - 1e-4) {
        return [
            `M ${cx} ${cy - radius}`,
            `A ${radius} ${radius} 0 1 1 ${cx} ${cy + radius}`,
            `A ${radius} ${radius} 0 1 1 ${cx} ${cy - radius}`,
            'Z',
        ].join(' ');
    }

    const x1 = cx + radius * Math.cos(startAngle);
    const y1 = cy + radius * Math.sin(startAngle);
    const x2 = cx + radius * Math.cos(endAngle);
    const y2 = cy + radius * Math.sin(endAngle);
    const largeArc = sweep > Math.PI ? 1 : 0;

    return [
        `M ${cx} ${cy}`,
        `L ${x1} ${y1}`,
        `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
        'Z',
    ].join(' ');
}
