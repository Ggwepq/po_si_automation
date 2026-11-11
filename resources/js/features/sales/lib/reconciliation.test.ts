import { describe, expect, it } from 'vitest';
import { issueCount, reconciliationSentence } from './reconciliation';
import { reconciliation } from './reconciliation.fixture';

const money = (v: number) => `P${v}`;

describe('reconciliation sentence', () => {
    it('lists what does not match', () => {
        expect(issueCount(reconciliation())).toBe(3);
        expect(reconciliationSentence(reconciliation(), money)).toBe(
            "3 store-days do not match SM's DSR Summary (2 DSR not imported, 1 amount differs). Imported DSRs total P950 versus SM's P1000.",
        );
    });

    it('confirms a balanced month', () => {
        expect(
            reconciliationSentence(
                reconciliation({ balanced: true, detailTotal: '1000.00' }),
                money,
            ),
        ).toBe(
            "The imported DSRs match SM's DSR Summary for all 31 days checked (P1000).",
        );
    });

    it('says nothing when no Summary was imported', () => {
        expect(
            reconciliationSentence(reconciliation({ checked: false }), money),
        ).toBeNull();
    });
});
