import * as XLSX from 'xlsx';
import { parseDsrWorkbook } from './parse-dsr';

export type DsrWorkerRequest = { bytes: ArrayBuffer };

// Typed locally: the project compiles against DOM types, not WebWorker types.
const scope = self as unknown as {
    onmessage: ((event: MessageEvent<DsrWorkerRequest>) => void) | null;
    postMessage: (message: unknown) => void;
};

// Large multi-month exports are parsed here so the page stays responsive.
scope.onmessage = ({ data }) => {
    try {
        const workbook = XLSX.read(data.bytes, { type: 'array' });
        scope.postMessage({ result: parseDsrWorkbook(workbook) });
    } catch (error) {
        scope.postMessage({ error: (error as Error).message });
    }
};
