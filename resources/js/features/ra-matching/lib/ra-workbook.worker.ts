import { readRAWorkbook } from './ra-matching';
import type { WorkbookKind } from './types';

export type WorkerRequest = {
    bytes: ArrayBuffer;
    kind: WorkbookKind;
    name: string;
    size: number;
};

// Typed locally: the project compiles against DOM types, not WebWorker types.
const scope = self as unknown as {
    onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
    postMessage: (message: unknown) => void;
};

// Parsing large workbooks happens here so the page stays responsive.
scope.onmessage = ({ data }) => {
    readRAWorkbook(
        {
            name: data.name,
            size: data.size,
            arrayBuffer: async () => data.bytes,
        },
        data.kind,
    ).then(
        (result) => scope.postMessage({ result }),
        (error: unknown) =>
            scope.postMessage({ error: (error as Error).message }),
    );
};
