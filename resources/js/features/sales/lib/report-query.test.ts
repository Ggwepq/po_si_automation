import { describe, expect, it } from 'vitest';
import { addDays, presets, rangeOf, reportUrl } from './report-query';

describe('rangeOf', () => {
    it.each([
        ['daily', '2026-11-11', '2026-11-11', '2026-11-11'],
        ['weekly', '2026-11-11', '2026-11-09', '2026-11-15'],
        ['weekly', '2026-11-15', '2026-11-09', '2026-11-15'],
        ['monthly', '2026-02-10', '2026-02-01', '2026-02-28'],
        ['quarterly', '2026-11-11', '2026-10-01', '2026-12-31'],
        ['yearly', '2026-11-11', '2026-01-01', '2026-12-31'],
    ] as const)('%s containing %s is %s to %s', (type, date, start, end) => {
        expect(rangeOf(type, date)).toEqual([start, end]);
    });

    it('steps across month and year ends', () => {
        expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
        expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    });
});

describe('presets', () => {
    const byId = (id: string) =>
        presets('2026-11-11', '2026-11-10').find((p) => p.id === id);

    it('offers the latest sales day first when data exists', () => {
        expect(presets('2026-11-11', '2026-11-10')[0]).toMatchObject({
            id: 'latest',
            start: '2026-11-10',
        });
        expect(presets('2026-11-11', null)[0].id).toBe('today');
    });

    it('computes common ranges from today', () => {
        expect(byId('yesterday')).toMatchObject({
            period: 'daily',
            start: '2026-11-10',
        });
        expect(byId('last7')).toMatchObject({
            period: 'custom',
            start: '2026-11-05',
            end: '2026-11-11',
        });
        expect(byId('lastWeek')).toMatchObject({
            start: '2026-11-02',
            end: '2026-11-08',
        });
        expect(byId('lastMonth')).toMatchObject({
            period: 'monthly',
            start: '2026-10-01',
            end: '2026-10-31',
        });
        expect(byId('lastYear')).toMatchObject({
            start: '2025-01-01',
            end: '2025-12-31',
        });
    });
});

describe('reportUrl', () => {
    it('encodes filters as arrays and the end date only for custom ranges', () => {
        const url = reportUrl('/sales/report', {
            period: 'monthly',
            date: '2026-11-01',
            end: '2026-11-30',
            vendors: [],
            companies: ['SVI', 'SSM'],
            sites: ['0001'],
        });

        expect(decodeURIComponent(url)).toBe(
            '/sales/report?period=monthly&date=2026-11-01&companies[]=SVI&companies[]=SSM&sites[]=0001',
        );
        expect(
            reportUrl('/r', {
                period: 'custom',
                date: '2026-11-01',
                end: '2026-11-07',
                vendors: [],
                companies: [],
                sites: [],
            }),
        ).toBe('/r?period=custom&date=2026-11-01&end=2026-11-07');
    });
});
