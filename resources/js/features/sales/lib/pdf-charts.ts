import type { jsPDF } from 'jspdf';
import type { Slice } from './format';

/*
 * Pie (donut) charts drawn directly with jsPDF shapes: vector-sharp at any
 * zoom, small, and independent of the screen theme (print colours on white).
 * Sizes are in millimetres.
 */

/** Print versions of the theme's pastel chart colours; "Others" is grey. */
export const PDF_COLORS = [
    '#3f51b5',
    '#e8b931',
    '#7f9be0',
    '#4fae8a',
    '#e3896a',
    '#9a7bd0',
    '#5fb4d3',
];
const OTHERS = '#c9ccd6';
export const INK = '#1f2747';
export const MUTED = '#6b7190';

export const pdfMoney = (value: number) =>
    value.toLocaleString('en-PH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

export const pdfQty = (value: number) =>
    value.toLocaleString('en-PH', { maximumFractionDigits: 3 });

const sliceColor = (slice: Slice, index: number) =>
    slice.name === 'Others' ? OTHERS : PDF_COLORS[index % PDF_COLORS.length];

/** Fits text into a width, adding "..." when it is cut. */
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

export type DonutOptions = {
    radius?: number;
    /** Amount column in the legend; off for narrow, half-width charts. */
    showAmount?: boolean;
    format?: (value: number) => string;
    /** Short text in the hole, e.g. the total. */
    centre?: { value: string; label: string };
};

/** Donut chart with a legend (name, share, amount) to its right. */
export function donutWithLegend(
    doc: jsPDF,
    slices: Slice[],
    x: number,
    y: number,
    width: number,
    options: DonutOptions = {},
): number {
    const {
        radius = 17,
        showAmount = true,
        format = pdfMoney,
        centre,
    } = options;
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
                radius * 0.6,
                angle,
                angle + sweep,
            );
        }

        angle += sweep;
    });

    if (centre) {
        doc.setFont('helvetica', 'bold')
            .setFontSize(radius > 18 ? 9 : 7.5)
            .setTextColor(INK)
            .text(centre.value, cx, cy + 0.5, { align: 'center' });
        doc.setFont('helvetica', 'normal')
            .setFontSize(6)
            .setTextColor(MUTED)
            .text(centre.label, cx, cy + 3.8, { align: 'center' });
    }

    const legendX = x + radius * 2 + 6;
    const legendWidth = width - radius * 2 - 6;
    const rowHeight = 5.2;
    let rowY = cy - ((slices.length - 1) * rowHeight) / 2 + 1;

    doc.setFont('helvetica', 'normal').setFontSize(7.5);

    slices.forEach((slice, index) => {
        doc.setFillColor(sliceColor(slice, index)).circle(
            legendX + 1.2,
            rowY - 1,
            1.2,
            'F',
        );
        const amount = showAmount ? format(slice.value) : '';
        const share = `${slice.share.toFixed(1)}%`;
        const amountWidth = showAmount ? doc.getTextWidth(amount) + 3 : 0;

        doc.setTextColor(INK).setFont('helvetica', 'bold');
        doc.text(share, legendX + legendWidth - amountWidth, rowY, {
            align: 'right',
        });
        doc.setFont('helvetica', 'normal');

        if (showAmount) {
            doc.setTextColor(MUTED).text(amount, legendX + legendWidth, rowY, {
                align: 'right',
            });
        }

        const nameWidth =
            legendWidth - amountWidth - doc.getTextWidth(share) - 8;
        doc.setTextColor(INK).text(
            fit(doc, slice.name, nameWidth),
            legendX + 4,
            rowY,
        );
        rowY += rowHeight;
    });

    return Math.max(y + radius * 2, rowY) + 2;
}

export const peso = (value: number) => `PHP ${pdfMoney(value)}`;
