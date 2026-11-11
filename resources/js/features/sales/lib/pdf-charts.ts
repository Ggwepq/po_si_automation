import type { jsPDF } from 'jspdf';
import type { Slice } from './format';

/*
 * Charts drawn directly with jsPDF shapes: vector-sharp at any zoom, small,
 * and independent of the screen theme (always print colours on white).
 * Sizes are in millimetres.
 */

/** Print versions of the theme's pastel chart colours; "Others" is grey. */
export const PDF_COLORS = [
    '#5b6fc7',
    '#e3c54f',
    '#8fa8e0',
    '#6fbf9f',
    '#e39a7a',
    '#a98bd6',
];
const OTHERS = '#c9ccd6';
export const INK = '#2b3150';
export const MUTED = '#6b7190';
const GRID = '#e3e6ef';

export const pdfMoney = (value: number) =>
    value.toLocaleString('en-PH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

export const pdfQty = (value: number) =>
    value.toLocaleString('en-PH', { maximumFractionDigits: 3 });

const sliceColor = (slice: Slice, index: number) =>
    slice.name === 'Others' ? OTHERS : PDF_COLORS[index % PDF_COLORS.length];

/** Fits text into a width, adding "…" when it is cut. */
export function fit(doc: jsPDF, text: string, width: number): string {
    if (doc.getTextWidth(text) <= width) {
        return text;
    }

    let cut = text;

    while (cut.length > 1 && doc.getTextWidth(`${cut}...`) > width) {
        cut = cut.slice(0, -1);
    }

    return `${cut}...`;
}

/** A filled ring segment, approximated by short straight edges. */
function ringSegment(
    doc: jsPDF,
    cx: number,
    cy: number,
    outer: number,
    inner: number,
    from: number,
    to: number,
) {
    const step = Math.PI / 90;
    const points: [number, number][] = [];

    for (let a = from; a < to; a += step) {
        points.push([cx + outer * Math.cos(a), cy + outer * Math.sin(a)]);
    }

    points.push([cx + outer * Math.cos(to), cy + outer * Math.sin(to)]);

    for (let a = to; a > from; a -= step) {
        points.push([cx + inner * Math.cos(a), cy + inner * Math.sin(a)]);
    }

    points.push([cx + inner * Math.cos(from), cy + inner * Math.sin(from)]);

    const [start, ...rest] = points;
    const deltas = rest.map(([x, y], i) => [
        x - (i === 0 ? start[0] : rest[i - 1][0]),
        y - (i === 0 ? start[1] : rest[i - 1][1]),
    ]);

    doc.lines(deltas, start[0], start[1], [1, 1], 'F', true);
}

/** Donut chart with a legend (name, share, amount) to its right. */
export function donutWithLegend(
    doc: jsPDF,
    slices: Slice[],
    x: number,
    y: number,
    width: number,
    format = pdfMoney,
): number {
    const radius = 17;
    const cx = x + radius;
    const cy = y + radius;

    if (!slices.length) {
        doc.setFontSize(8)
            .setTextColor(MUTED)
            .text('No sales in this period.', x, y + 6);

        return y + 10;
    }

    const total = slices.reduce((sum, s) => sum + Math.max(0, s.value), 0) || 1;
    let angle = -Math.PI / 2;

    slices.forEach((slice, index) => {
        const sweep = (Math.max(0, slice.value) / total) * Math.PI * 2;

        if (sweep > 0.001) {
            doc.setFillColor(sliceColor(slice, index));
            ringSegment(
                doc,
                cx,
                cy,
                radius,
                radius * 0.58,
                angle,
                angle + sweep,
            );
        }

        angle += sweep;
    });

    const legendX = x + radius * 2 + 6;
    const legendWidth = width - radius * 2 - 6;
    let rowY = y + 3;

    doc.setFontSize(7.5);

    slices.forEach((slice, index) => {
        doc.setFillColor(sliceColor(slice, index)).circle(
            legendX + 1.2,
            rowY - 1,
            1.2,
            'F',
        );
        const amount = format(slice.value);
        const share = `${slice.share.toFixed(1)}%`;
        doc.setTextColor(MUTED).text(
            share,
            legendX + legendWidth - doc.getTextWidth(amount) - 3,
            rowY,
            { align: 'right' },
        );
        doc.setTextColor(INK).text(amount, legendX + legendWidth, rowY, {
            align: 'right',
        });
        const nameWidth =
            legendWidth -
            doc.getTextWidth(amount) -
            doc.getTextWidth(share) -
            10;
        doc.text(fit(doc, slice.name, nameWidth), legendX + 4, rowY);
        rowY += 5;
    });

    return Math.max(y + radius * 2, rowY) + 2;
}

/** Horizontal bar chart: label, bar, value. Returns the y below it. */
export function barChart(
    doc: jsPDF,
    rows: { name: string; value: number }[],
    x: number,
    y: number,
    width: number,
    format: (v: number) => string,
): number {
    const labelWidth = 62;
    const valueWidth = 22;
    const barArea = width - labelWidth - valueWidth - 4;
    const max = Math.max(...rows.map((r) => r.value), 0) || 1;
    const rowHeight = 6.5;

    doc.setFontSize(7.5);

    rows.forEach((row, index) => {
        const rowY = y + index * rowHeight;
        const barWidth = Math.max(0.5, (row.value / max) * barArea);

        doc.setTextColor(INK).text(
            fit(doc, row.name, labelWidth - 2),
            x,
            rowY + 4,
        );
        doc.setFillColor(PDF_COLORS[0]).roundedRect(
            x + labelWidth,
            rowY + 1,
            barWidth,
            rowHeight - 2.5,
            0.8,
            0.8,
            'F',
        );
        doc.setTextColor(MUTED).text(
            format(row.value),
            x + labelWidth + barWidth + 2,
            rowY + 4,
        );
    });

    return y + rows.length * rowHeight + 2;
}

/** Sales line over time with a light grid and min/mid/max labels. */
export function trendChart(
    doc: jsPDF,
    points: { label: string; value: number }[],
    x: number,
    y: number,
    width: number,
    height: number,
): number {
    const axisWidth = 18;
    const plotX = x + axisWidth;
    const plotWidth = width - axisWidth;
    const plotHeight = height - 8;
    const max = Math.max(...points.map((p) => p.value), 0) || 1;

    doc.setFontSize(7).setDrawColor(GRID).setLineWidth(0.2);

    [0, 0.5, 1].forEach((fraction) => {
        const lineY = y + plotHeight - fraction * plotHeight;
        doc.line(plotX, lineY, plotX + plotWidth, lineY);
        doc.setTextColor(MUTED).text(
            pdfMoney(max * fraction).replace('.00', ''),
            plotX - 2,
            lineY + 1,
            { align: 'right' },
        );
    });

    if (points.length) {
        const stepX = points.length > 1 ? plotWidth / (points.length - 1) : 0;
        const coords = points.map((p, i): [number, number] => [
            plotX + i * stepX,
            y + plotHeight - (p.value / max) * plotHeight,
        ]);

        doc.setDrawColor(PDF_COLORS[0]).setLineWidth(0.6);

        if (coords.length === 1) {
            doc.setFillColor(PDF_COLORS[0]).circle(
                coords[0][0] + plotWidth / 2,
                coords[0][1],
                1,
                'F',
            );
        } else {
            coords
                .slice(1)
                .forEach(([px, py], i) =>
                    doc.line(coords[i][0], coords[i][1], px, py),
                );
        }

        const labelIndexes = [
            ...new Set([
                0,
                Math.floor((points.length - 1) / 2),
                points.length - 1,
            ]),
        ];

        doc.setTextColor(MUTED);
        labelIndexes.forEach((i) => {
            const align =
                i === 0 ? 'left' : i === points.length - 1 ? 'right' : 'center';
            doc.text(points[i].label, coords[i][0], y + height, { align });
        });
    }

    return y + height + 3;
}
