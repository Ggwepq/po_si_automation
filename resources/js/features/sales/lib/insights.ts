import {
    distributionGaps,
    storeConcentration,
    weekdayWeekendSplit,
} from './ceo-metrics';
import { percentChange } from './format';
import { reconciliationSentence } from './reconciliation';
import type { DsrCoverage, DsrReconciliation, SalesReport } from './types';

export type Insight = {
    /** Short label, e.g. "Best store". */
    title: string;
    text: string;
    tone: 'positive' | 'negative' | 'neutral' | 'warning';
};

type Options = {
    previousLabel: string;
    money: (value: number) => string;
    qty: (value: number) => string;
    coverage?: DsrCoverage;
    reconciliation?: DsrReconciliation;
};

/**
 * Plain-language highlights for management, derived only from the report
 * data (no guesses): change vs the previous period, best/weakest store,
 * best seller, leading company, how concentrated sales are, and whether the
 * imported data is complete.
 */
export function buildInsights(
    report: SalesReport,
    options: Options,
): Insight[] {
    const { summary, byStore, byCompany, items } = report;
    const { money, qty, previousLabel } = options;
    const insights: Insight[] = [];

    if (summary.totalSales === 0 && items.length === 0) {
        return [
            {
                title: 'No sales',
                text: 'No sales were imported for this period.',
                tone: 'warning',
            },
        ];
    }

    const change = percentChange(
        summary.totalSales,
        summary.previous.totalSales,
    );
    insights.push({
        title: 'Total sales',
        text:
            change === null
                ? `${money(summary.totalSales)} from ${qty(summary.totalQty)} units sold (no data for ${previousLabel} to compare).`
                : `${money(summary.totalSales)}, ${change >= 0 ? 'up' : 'down'} ${Math.abs(change)}% vs ${previousLabel} (${money(summary.previous.totalSales)}).`,
        tone:
            change === null || change === 0
                ? 'neutral'
                : change > 0
                  ? 'positive'
                  : 'negative',
    });

    const bestStore = byStore[0];

    if (bestStore) {
        insights.push({
            title: 'Best store',
            text: `${bestStore.name}: ${money(bestStore.sales)} (${bestStore.share}% of sales)${bestStore.topItem ? `, led by ${bestStore.topItem}` : ''}.`,
            tone: 'positive',
        });
    }

    const bestItem = [...items].sort((a, b) => b.sales - a.sales)[0];

    if (bestItem) {
        insights.push({
            title: 'Best-selling item',
            text: `${bestItem.description}: ${qty(bestItem.qty)} units, ${money(bestItem.sales)} (${bestItem.share}% of sales), sold in ${bestItem.storeCount} store${bestItem.storeCount === 1 ? '' : 's'}.`,
            tone: 'positive',
        });
    }

    if (byCompany.length > 1) {
        const leader = byCompany[0];
        insights.push({
            title: 'Leading company',
            text: `${leader.company} stores brought in ${leader.share}% of sales (${money(leader.sales)}).`,
            tone: 'neutral',
        });
    }

    const split = weekdayWeekendSplit(
        report.trend.grouping,
        report.trend.points,
    );

    if (
        split &&
        split.weekday.days > 0 &&
        split.weekend.days > 0 &&
        split.weekday.average > 0
    ) {
        const lift = Math.round(
            ((split.weekend.average - split.weekday.average) /
                split.weekday.average) *
                100,
        );
        insights.push({
            title: 'Weekends vs weekdays',
            text: `A weekend day averages ${money(split.weekend.average)} against ${money(split.weekday.average)} on a weekday (${lift >= 0 ? '+' : ''}${lift}%).`,
            tone: 'neutral',
        });
    }

    const reliance = storeConcentration(byStore);

    if (reliance) {
        insights.push({
            title: 'Store reliance',
            text: `The top ${reliance.topCount} of ${reliance.storeCount} stores generate ${reliance.share}% of sales.`,
            tone: reliance.share >= 50 ? 'warning' : 'neutral',
        });
    }

    const opportunity = distributionGaps(items, summary.storeCount).sort(
        (a, b) => b.potential - a.potential,
    )[0];

    if (opportunity) {
        insights.push({
            title: 'Growth opportunity',
            text: `${opportunity.item.description} sells in ${opportunity.item.storeCount} of ${summary.storeCount} stores. At its current average of ${money(opportunity.salesPerStore)} per store, the other ${opportunity.missingStores} could add about ${money(opportunity.potential)} (estimate).`,
            tone: 'positive',
        });
    }

    if (byStore.length > 2) {
        const weakest = byStore[byStore.length - 1];
        insights.push({
            title: 'Lowest store',
            text: `${weakest.name}: ${money(weakest.sales)} (${weakest.share}% of sales) — worth a look.`,
            tone: 'negative',
        });
    }

    if (items.length > 3) {
        const topThree = [...items]
            .sort((a, b) => b.sales - a.sales)
            .slice(0, 3);
        const share =
            Math.round(
                topThree.reduce((sum, item) => sum + item.share, 0) * 10,
            ) / 10;
        insights.push({
            title: 'Concentration',
            text: `The top 3 of ${items.length} items make up ${share}% of sales.`,
            tone: 'neutral',
        });
    }

    const coverage = options.coverage;

    if (coverage && coverage.daysWithoutAnyDsr.length > 0) {
        insights.push({
            title: 'Data check',
            text: `${coverage.daysWithoutAnyDsr.length} day${coverage.daysWithoutAnyDsr.length === 1 ? '' : 's'} in this period have no imported DSR, so totals may be understated.`,
            tone: 'warning',
        });
    }

    const reconciliation =
        options.reconciliation &&
        reconciliationSentence(options.reconciliation, money);

    if (options.reconciliation && reconciliation) {
        insights.push({
            title: 'Month-end check',
            text: reconciliation,
            tone: options.reconciliation.balanced ? 'positive' : 'warning',
        });
    }

    return insights;
}
