import type { ReportPdfInput } from './report-pdf';

/**
 * Loads the company logo as a PNG data URL with its size. Drawing it on a
 * canvas converts any web format (e.g. WebP) to PNG, which jsPDF supports.
 */
async function loadLogo(url: string | null): Promise<ReportPdfInput['logo']> {
    if (!url) {
        return undefined;
    }

    try {
        const bitmap = await createImageBitmap(await (await fetch(url)).blob());
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        canvas.getContext('2d')?.drawImage(bitmap, 0, 0);

        return {
            dataUrl: canvas.toDataURL('image/png'),
            width: bitmap.width,
            height: bitmap.height,
        };
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
    logoUrl: string | null,
    fileName: string,
): Promise<void> {
    const tab = window.open('', '_blank');

    tab?.document.write(
        '<p style="font-family:sans-serif;padding:24px;color:#555">Preparing the PDF…</p>',
    );

    try {
        const [{ buildReportPdf }, logo] = await Promise.all([
            import('./report-pdf'),
            loadLogo(logoUrl),
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
