import { usePage } from '@inertiajs/react';
import { useState } from 'react';
import { assertWithinLimits, batchesOf } from '../../lib/import-plan';
import { readDsrFile } from '../../lib/read-dsr-file';
import type { ParsedSalesFile } from '../../lib/types';
import { postImportBatch } from '../../post-import-batch';
import type { ImportResult } from '../../post-import-batch';

export type ImportStep = 'choose' | 'review' | 'done';

export type ImportedFile = ImportResult & {
    fileName: string;
    parsed: ParsedSalesFile;
};

/**
 * One file through the import: read and check it in the browser, review it,
 * then send it in batches. Shared by the Import page and the import dialog.
 */
export function useSalesImport() {
    const limits = usePage().props.sales?.importLimits;
    const [file, setFile] = useState<{
        name: string;
        parsed: ParsedSalesFile;
    } | null>(null);
    const [reading, setReading] = useState(false);
    const [saving, setSaving] = useState<{
        done: number;
        total: number;
    } | null>(null);
    const [result, setResult] = useState<ImportedFile | null>(null);
    const [error, setError] = useState('');

    const step: ImportStep = result ? 'done' : file ? 'review' : 'choose';

    const select = async (selected: File) => {
        setReading(true);
        setError('');
        setResult(null);

        try {
            const parsed = await readDsrFile(selected);

            if (limits) {
                assertWithinLimits(parsed, limits);
            }

            setFile({ name: selected.name, parsed });
        } catch (e) {
            setFile(null);
            setError((e as Error).message);
        } finally {
            setReading(false);
        }
    };

    const run = async () => {
        if (!file || !limits) {
            return;
        }

        const batches = batchesOf(file.parsed, limits);
        const total: ImportedFile = {
            fileName: file.name,
            parsed: file.parsed,
            reportCount: 0,
            lineCount: 0,
            replacedCount: 0,
        };
        setError('');

        try {
            for (const [index, batch] of batches.entries()) {
                setSaving({ done: index, total: batches.length });
                const name =
                    batches.length > 1
                        ? `${file.name} (part ${index + 1} of ${batches.length})`
                        : file.name;
                const saved = await postImportBatch(name, batch);
                total.reportCount += saved.reportCount;
                total.lineCount += saved.lineCount;
                total.replacedCount += saved.replacedCount;
            }

            setResult(total);
            setFile(null);
        } catch (e) {
            setError(
                `Import stopped: ${(e as Error).message} Parts before this one were saved; importing the file again is safe.`,
            );
        } finally {
            setSaving(null);
        }
    };

    const reset = () => {
        setFile(null);
        setResult(null);
        setError('');
    };

    return { step, file, reading, saving, result, error, select, run, reset };
}
