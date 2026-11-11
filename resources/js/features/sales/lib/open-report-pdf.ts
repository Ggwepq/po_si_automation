import type { ReportPdfInput } from './report-pdf';

const LOGO_URL = '/images/park-solutions-logo.png';

async function loadLogo(): Promise<string | undefined> {
    try {
        const blob = await (await fetch(LOGO_URL)).blob();

        return await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () =>
                resolve(
                    typeof reader.result === 'string'
                        ? reader.result
                        : undefined,
                );
            reader.onerror = () => resolve(undefined);
            reader.readAsDataURL(blob);
        });
    } catch {
        // The report is still useful without the logo.
        return undefined;
    }
}

/**
 * Builds the PDF and shows it in a new tab (optionally opening the print
 * dialog). The tab is opened before any waiting so pop-up blockers allow it;
 * the PDF library is loaded only now, keeping the report page light.
 */
export async function openReportPdf(
    input: Omit<ReportPdfInput, 'logo'>,
    fileName: string,
): Promise<void> {
    const tab = window.open('', '_blank');

    tab?.document.write(
        '<p style="font-family:sans-serif;padding:24px;color:#555">Preparing the PDF…</p>',
    );

    try {
        const [{ buildReportPdf }, logo] = await Promise.all([
            import('./report-pdf'),
            loadLogo(),
        ]);
        const doc = buildReportPdf({ ...input, logo });
        const url = URL.createObjectURL(doc.output('blob'));

        if (tab) {
            tab.location.href = url;
        } else {
            // Pop-ups blocked: download instead.
            doc.save(fileName);
        }

        setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
        tab?.close();
        throw error;
    }
}
