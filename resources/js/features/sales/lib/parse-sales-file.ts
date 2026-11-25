import type * as XLSX from 'xlsx';
import { parseDsrWorkbook } from './parse-dsr';
import {
    isDsrSummaryWorkbook,
    parseDsrSummaryWorkbook,
} from './parse-dsr-summary';
import {
    parseClrWorkbook,
    parseCsrWorkbook,
    settlementKind,
} from './parse-settlement';
import type { ParsedSalesFile } from './types';

/**
 * Reads any export the Import page accepts: the DSR, the DSR Summary, the
 * Consolidated Sales Report or the Consolidated Liquidation Report. The CSR
 * is checked first: it also has article codes, so it would look like a DSR.
 */
export function parseSalesWorkbook(workbook: XLSX.WorkBook): ParsedSalesFile {
    switch (settlementKind(workbook)) {
        case 'clr':
            return parseClrWorkbook(workbook);
        case 'csr':
            return parseCsrWorkbook(workbook);
    }

    return isDsrSummaryWorkbook(workbook)
        ? parseDsrSummaryWorkbook(workbook)
        : parseDsrWorkbook(workbook);
}
