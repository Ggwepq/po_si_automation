import type { jsPDF } from 'jspdf';
import type { UserOptions } from 'jspdf-autotable';
import { INK, MUTED } from './pdf-charts';

/*
 * Page layout for the A4 sales report: a cursor that moves down the page,
 * section headers, KPI tiles, takeaway cards and the shared table style.
 * Sizes are in millimetres.
 */

export const PAGE = { width: 210, height: 297, margin: 14 };
export const CONTENT = PAGE.width - PAGE.margin * 2;
export const HALF = (CONTENT - 8) / 2;

export const NAVY = '#1f2a6b';
export const ACCENT = '#e8b931';
export const TONE_COLORS = {
    positive: '#2e8b57',
    negative: '#c0392b',
    warning: '#c98a0b',
    neutral: '#5b6fc7',
} as const;
export type Tone = keyof typeof TONE_COLORS;

export type Tile = { label: string; value: string; note: string; tone: Tone };

const BOTTOM = PAGE.height - 18;

export class PdfLayout {
    y = PAGE.margin;

    constructor(readonly doc: jsPDF) {}

    /** Starts a new page when `height` does not fit on this one. */
    ensureSpace(height: number): void {
        if (this.y + height > BOTTOM) {
            this.newPage();
        }
    }

    newPage(): void {
        this.doc.addPage();
        this.y = PAGE.margin;
    }

    /** A new page that opens a report chapter, e.g. "Store performance". */
    chapter(number: number, title: string, intro: string): void {
        this.newPage();
        const { doc } = this;

        doc.setFillColor(NAVY).rect(0, 0, PAGE.width, 4, 'F');
        doc.setFont('helvetica', 'bold')
            .setFontSize(8)
            .setTextColor(ACCENT)
            .text(`SECTION ${number}`, PAGE.margin, this.y + 4);
        doc.setFontSize(16)
            .setTextColor(INK)
            .text(title, PAGE.margin, this.y + 11);
        doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(MUTED);
        const lines = doc.splitTextToSize(intro, CONTENT) as string[];
        doc.text(lines, PAGE.margin, this.y + 17);
        this.y += 17 + lines.length * 4 + 4;
    }

    /** `keepWith`: height of the content that must stay on the heading's page. */
    heading(text: string, subtitle?: string, keepWith = 25): void {
        const { doc } = this;
        this.ensureSpace((subtitle ? 12 : 8) + keepWith);
        doc.setFillColor(ACCENT).rect(PAGE.margin, this.y + 0.6, 1.2, 4.6, 'F');
        doc.setFont('helvetica', 'bold')
            .setFontSize(11)
            .setTextColor(INK)
            .text(text, PAGE.margin + 3.5, this.y + 4.5);

        if (subtitle) {
            doc.setFont('helvetica', 'normal')
                .setFontSize(8)
                .setTextColor(MUTED)
                .text(subtitle, PAGE.margin + 3.5, this.y + 9);
        }

        this.y += subtitle ? 13 : 9;
        doc.setFont('helvetica', 'normal');
    }

    /** Small bold title above a chart placed at `x`. */
    chartTitle(text: string, x: number): void {
        this.doc
            .setFont('helvetica', 'bold')
            .setFontSize(9)
            .setTextColor(INK)
            .text(text, x, this.y)
            .setFont('helvetica', 'normal');
    }

    /** A row of KPI tiles: label, big value, coloured note. */
    tiles(tiles: Tile[], perRow = 4): void {
        const { doc } = this;
        const gap = 3;
        const width = (CONTENT - gap * (perRow - 1)) / perRow;
        const height = 21;

        tiles.forEach((tile, index) => {
            const column = index % perRow;

            if (column === 0 && index > 0) {
                this.y += height + gap;
            }

            const x = PAGE.margin + column * (width + gap);
            doc.setFillColor('#f3f5fb').roundedRect(
                x,
                this.y,
                width,
                height,
                1.5,
                1.5,
                'F',
            );
            doc.setFillColor(TONE_COLORS[tile.tone]).rect(
                x,
                this.y + 3,
                0.9,
                height - 6,
                'F',
            );
            doc.setFont('helvetica', 'normal')
                .setFontSize(6.5)
                .setTextColor(MUTED)
                .text(tile.label.toUpperCase(), x + 3.5, this.y + 6);
            doc.setFont('helvetica', 'bold')
                .setFontSize(12.5)
                .setTextColor(INK)
                .text(tile.value, x + 3.5, this.y + 12.8);
            doc.setFont('helvetica', 'normal')
                .setFontSize(6.8)
                .setTextColor(
                    tile.tone === 'neutral' ? MUTED : TONE_COLORS[tile.tone],
                )
                .text(
                    doc.splitTextToSize(tile.note, width - 6) as string[],
                    x + 3.5,
                    this.y + 17.6,
                );
        });

        this.y += height + 7;
    }

    /** Numbered takeaways with a coloured marker per tone. */
    takeaways(items: { title: string; text: string; tone: Tone }[]): void {
        const { doc } = this;

        items.forEach((item, index) => {
            doc.setFontSize(8.6);
            const lines = doc.splitTextToSize(
                item.text,
                CONTENT - 12,
            ) as string[];
            const height = 4.2 + lines.length * 3.8;
            this.ensureSpace(height + 2);

            doc.setFillColor(TONE_COLORS[item.tone]).circle(
                PAGE.margin + 2.6,
                this.y + 2.4,
                2.6,
                'F',
            );
            doc.setFont('helvetica', 'bold')
                .setFontSize(7.5)
                .setTextColor('#ffffff')
                .text(String(index + 1), PAGE.margin + 2.6, this.y + 3.5, {
                    align: 'center',
                });
            doc.setFontSize(8.6)
                .setTextColor(INK)
                .text(item.title, PAGE.margin + 8, this.y + 3.3);
            doc.setFont('helvetica', 'normal')
                .setTextColor('#3a4160')
                .text(lines, PAGE.margin + 8, this.y + 7.6);
            this.y += height + 1.8;
        });

        this.y += 3;
    }

    /** A short paragraph in muted text. */
    note(text: string): void {
        const { doc } = this;
        doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(MUTED);
        const lines = doc.splitTextToSize(text, CONTENT) as string[];
        this.ensureSpace(lines.length * 3.8 + 2);
        doc.text(lines, PAGE.margin, this.y + 3);
        this.y += lines.length * 3.8 + 3;
    }

    /** Moves the cursor below the table jspdf-autotable just drew. */
    afterTable(): void {
        const last = (
            this.doc as unknown as { lastAutoTable?: { finalY?: number } }
        ).lastAutoTable;
        this.y = (last?.finalY ?? this.y) + 9;
    }

    tableStyle(): UserOptions {
        return {
            startY: this.y,
            theme: 'plain',
            margin: {
                left: PAGE.margin,
                right: PAGE.margin,
                top: PAGE.margin + 4,
                bottom: 20,
            },
            styles: {
                fontSize: 8,
                cellPadding: { top: 1.8, bottom: 1.8, left: 2, right: 2 },
                textColor: INK,
            },
            headStyles: {
                fillColor: NAVY,
                textColor: '#ffffff',
                fontStyle: 'bold',
                fontSize: 7.5,
            },
            alternateRowStyles: { fillColor: '#f6f7fb' },
        };
    }

    /** Running header (pages 2+) and footer with page numbers on every page. */
    finish(title: string, source: string): void {
        const { doc } = this;
        const pages = doc.getNumberOfPages();

        for (let page = 1; page <= pages; page++) {
            doc.setPage(page);
            doc.setDrawColor('#dfe3ee')
                .setLineWidth(0.2)
                .line(
                    PAGE.margin,
                    PAGE.height - 12,
                    PAGE.width - PAGE.margin,
                    PAGE.height - 12,
                );
            doc.setFont('helvetica', 'normal')
                .setFontSize(7)
                .setTextColor(MUTED);
            doc.text(`${title}  |  ${source}`, PAGE.margin, PAGE.height - 8);
            doc.text(
                `Page ${page} of ${pages}`,
                PAGE.width - PAGE.margin,
                PAGE.height - 8,
                { align: 'right' },
            );
            doc.text(
                'Confidential - for internal use',
                PAGE.width / 2,
                PAGE.height - 4.5,
                { align: 'center' },
            );
        }
    }
}
