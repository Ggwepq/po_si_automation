import { describe, expect, it } from 'vitest';
import {
    PIE_OTHERS_COLOR,
    layoutPieCallouts,
    pieSectorPath,
} from './pie-callouts';
import type { Slice } from './format';

const sampleSlices: Slice[] = [
    { name: 'Store A', value: 167534, share: 20.0 },
    { name: 'Store B', value: 140738, share: 16.8 },
    { name: 'Store C', value: 140256, share: 16.7 },
    { name: 'Store D', value: 129711, share: 15.5 },
    { name: 'Store E', value: 122731, share: 14.6 },
    { name: 'Store F', value: 70085, share: 8.4 },
    { name: 'Store G', value: 47343, share: 5.6 },
    { name: 'Others', value: 20406, share: 2.4 },
];

describe('layoutPieCallouts', () => {
    it('places non-overlapping callouts with anchor, elbow and horizontal leader lines', () => {
        const callouts = layoutPieCallouts(sampleSlices, {
            cx: 180,
            cy: 114,
            radius: 86,
            columnOffset: 100,
            minGap: 28,
            minY: 18,
            maxY: 210,
            elbowOffset: 10,
        });

        expect(callouts).toHaveLength(8);
        expect(callouts[7].color).toBe(PIE_OTHERS_COLOR);

        for (const side of ['left', 'right'] as const) {
            const sideCallouts = callouts
                .filter((c) => c.side === side)
                .sort((a, b) => a.labelY - b.labelY);

            for (let i = 1; i < sideCallouts.length; i++) {
                expect(
                    sideCallouts[i].labelY - sideCallouts[i - 1].labelY,
                ).toBeGreaterThanOrEqual(27.9);
            }

            for (const c of sideCallouts) {
                expect(c.elbowY).toBe(c.labelY);

                if (side === 'right') {
                    expect(c.elbowX).toBeGreaterThan(c.anchorX);
                    expect(c.labelX).toBeGreaterThan(c.elbowX);
                } else {
                    expect(c.elbowX).toBeLessThan(c.anchorX);
                    expect(c.labelX).toBeLessThan(c.elbowX);
                }
            }
        }
    });

    it('renders a valid closed SVG path for single-slice and multi-slice pies', () => {
        expect(pieSectorPath(100, 100, 50, 0, Math.PI * 2)).toContain(
            'A 50 50 0 1 1',
        );
        expect(pieSectorPath(100, 100, 50, 0, Math.PI / 2)).toContain(
            'M 100 100 L',
        );
    });
});
