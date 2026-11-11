import type * as XLSX from 'xlsx';
import { parseDsrWorkbook } from './parse-dsr';
import {
    isDsrSummaryWorkbook,
    parseDsrSummaryWorkbook,
} from './parse-dsr-summary';
import type { ParsedSalesFile } from './types';

/** Reads either export the Import page accepts: the DSR or the DSR Summary. */
export function parseSalesWorkbook(workbook: XLSX.WorkBook): ParsedSalesFile {
    return isDsrSummaryWorkbook(workbook)
        ? parseDsrSummaryWorkbook(workbook)
        : parseDsrWorkbook(workbook);
}
