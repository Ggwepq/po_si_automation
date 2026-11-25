import type { jsPDF } from 'jspdf';
import type { Slice } from './format';
import { PIE_COLORS, layoutPieCallouts } from './pie-callouts';

/*
 * Pie charts with leader-line callouts drawn directly with jsPDF shapes:
 * vector-sharp at any zoom, small, and independent of the screen theme.
 * Sizes are in millimetres.
 */

export const PDF_COLORS = PIE_COLORS;
export const INK = '#1f2747';
export const MUTED = '#6b7190';

export const pdfMoney = (value: number) =>
    value.toLocaleString('en-PH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

export const pdfQty = (value: number) =>
    value.toLocaleString('en-PH', { maximumFractionDigits: 3 });

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

/** A filled pie sector from the centre, with a white divider border. */
function pieSector(
    doc: jsPDF,
    cx: number,
    cy: number,
    radius: number,
    from: number,
    to: number,
) {
    const step = Math.PI / 90;
    const sweep = to - from;
    const points: [number, number][] =
        sweep >= Math.PI * 2 - 1e-4 ? [] : [[cx, cy]];

    for (let a = from; a < to; a += step) {
        points.push([cx + radius * Math.cos(a), cy + radius * Math.sin(a)]);
    }

    points.push([cx + radius * Math.cos(to), cy + radius * Math.sin(to)]);

    const [start, ...rest] = points;
    const deltas = rest.map(([x, y], i) => [
        x - (i === 0 ? start[0] : rest[i - 1][0]),
        y - (i === 0 ? start[1] : rest[i - 1][1]),
    ]);

    doc.setDrawColor('#ffffff').setLineWidth(0.35);
    doc.lines(deltas, start[0], start[1], [1, 1], 'FD', true);
}

export type DonutOptions = {
    radius?: number;
    /** Amount column in the legend; off for narrow, half-width charts. */
    showAmount?: boolean;
    format?: (value: number) => string;
    /** Optional centre caption summary (rendered in the legend header if present). */
    centre?: { value: string; label: string };
};

/**
 * Solid pie chart with leader-line callouts (white-ringed dot inside each
 * slice -> angled segment -> horizontal line -> value & share) and a colour
 * legend for the slice names.
 */
export function donutWithLegend(
    doc: jsPDF,
    slices: Slice[],
    x: number,
    y: number,
    width: number,
    options: DonutOptions = {},
): number {
    const { radius = 15, format = pdfMoney } = options;
    const wide = width > 120;
    const r = Math.min(radius, wide ? 22 : 15);
    const colOffset = r + (wide ? 9 : 4.5);
    const pieAreaWidth = wide ? Math.min(width * 0.58, 104) : width;
    const cx = x + pieAreaWidth / 2;
    const padTop = 4;
    const cy = y + padTop + r;
    const callouts = layoutPieCallouts(slices, {
        cx,
        cy,
        radius: r,
        columnOffset: colOffset,
        minGap: 5.2,
        minY: y + 2.5,
        maxY: cy + r + 3,
        elbowOffset: r * 0.16,
    });

    if (!callouts.length) {
        doc.setFontSize(8)
            .setTextColor(MUTED)
            .text('No sales in this period.', x, y + 6);

        return y + 10;
    }

    callouts.forEach((c) => {
        if (c.endAngle - c.startAngle > 0.001) {
            doc.setFillColor(c.color);
            pieSector(doc, cx, cy, r, c.startAngle, c.endAngle);
        }
    });

    callouts.forEach((c) => {
        const isRight = c.side === 'right';
        const textX = c.labelX + (isRight ? 1.1 : -1.1);
        const align = isRight ? 'left' : 'right';

        doc.setDrawColor(INK).setLineWidth(0.28);
        doc.line(c.anchorX, c.anchorY, c.elbowX, c.elbowY);
        doc.line(c.elbowX, c.elbowY, c.labelX, c.labelY);

        doc.setFillColor(INK)
            .setDrawColor('#ffffff')
            .setLineWidth(0.32)
            .circle(c.anchorX, c.anchorY, 0.72, 'FD');

        doc.setFont('helvetica', 'bold')
            .setFontSize(6.5)
            .setTextColor(INK)
            .text(format(c.slice.value), textX, c.labelY - 0.3, { align });
        doc.setFont('helvetica', 'normal')
            .setFontSize(5.8)
            .setTextColor(MUTED)
            .text(`${c.slice.share.toFixed(1)}%`, textX, c.labelY + 2.1, {
                align,
            });
    });

    const chartBottom = Math.max(
        cy + r + 2,
        ...callouts.map((c) => c.labelY + 3),
    );

    if (wide) {
        const legendX = x + pieAreaWidth + 4;
        const legendWidth = width - pieAreaWidth - 4;
        const rowHeight = 4.8;
        let rowY = cy - ((callouts.length - 1) * rowHeight) / 2 + 1;

        doc.setFont('helvetica', 'normal').setFontSize(7.2);
        callouts.forEach((c) => {
            doc.setFillColor(c.color).circle(
                legendX + 1.1,
                rowY - 0.9,
                1.1,
                'F',
            );
            doc.setTextColor(INK).text(
                fit(doc, c.slice.name, legendWidth - 5),
                legendX + 3.8,
                rowY,
            );
            rowY += rowHeight;
        });

        return Math.max(chartBottom, rowY) + 2;
    }

    // Half-width chart: compact two-column legend below the pie & callouts.
    const colWidth = (width - 4) / 2;
    const rowHeight = 4.2;
    let legendBottom = chartBottom + 2;

    doc.setFont('helvetica', 'normal').setFontSize(6.6);
    callouts.forEach((c, idx) => {
        const col = idx % 2;
        const row = Math.floor(idx / 2);
        const lx = x + col * (colWidth + 4);
        const ly = chartBottom + 3 + row * rowHeight;

        doc.setFillColor(c.color).circle(lx + 1, ly - 0.8, 0.95, 'F');
        doc.setTextColor(INK).text(
            fit(doc, c.slice.name, colWidth - 4),
            lx + 3.2,
            ly,
        );
        legendBottom = Math.max(legendBottom, ly + 1.5);
    });

    return legendBottom + 2;
}

export const peso = (value: number) => `PHP ${pdfMoney(value)}`;
