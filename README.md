# Automated SI & PO Workflow

Modular React app with plain CSS. All workbook processing happens in the browser; uploaded files are not saved or sent to a server.

## Run locally

Requires Node.js 20.19+ or 22.12+ and pnpm.

```sh
pnpm install
pnpm dev
pnpm test
pnpm build
```

## Modules

- `src/components`: reusable upload cards, results table, column settings, invoice workspace, and icons.
- `src/lib/workbooks.js`: XLSX parsing and results export.
- `src/lib/matching.js`: PO matching and summary counts, independent of React.
- `src/lib/demo.js`: explicitly labeled synthetic demo data.
- `src/styles.css`: responsive styling without a CSS framework.

## Matching and export

Matches PO numbers by exact text after trimming surrounding whitespace. Prefixes and leading zeros are preserved. Any PO number found in the GR workbook marks every corresponding PO item row Delivered. Quantities and partial deliveries are not evaluated. Blank PO numbers are marked Needs review. Unmatched GR POs are counted separately.

The preview retains every PO item row. Expand a row to inspect source fields and receipt references. Export includes all source PO columns and item rows plus Delivery Status, Matched GR PO No., and Matched Receipt No.; filters do not limit export. Imported values are read as displayed text to preserve identifiers and source presentation. Excel export therefore retains those values as text rather than converting them to financial/date types.

The first worksheet containing a PO No. header in its first 30 rows is selected automatically. Workbook settings allow sheet and PO column changes. Only .xlsx files up to 25 MB each are accepted.

## Deferred functionality

Sales invoice generation and both Outright exports are disabled until the invoice format, invoice data, and GR No. mapping are confirmed. Receipt No. is retained as a receipt reference and is not assumed to be the portal's GR No. No customer sample files are included in the published app.
