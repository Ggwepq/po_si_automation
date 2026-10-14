# PAUS Workflow Automation

Modular React app with plain CSS. All workbook processing happens in the browser; uploaded files are not saved or sent to a server.

The start screen offers **PO & SI workflow** and **RA item matching**. Returning to the workflow selector retains each screen's uploads until Start over is used or the page is reloaded.

## RA item matching

1. Upload RA_DETAIL and an ICR workbook (.xlsx, up to 100 MB each).
2. Choose the RA worksheet and one or more ICR month worksheets. Months are never selected automatically, including after replacing ICR.
3. Review matched, unmatched, and Needs review rows, then export updated RA_DETAIL.

Headers are detected in the first 30 rows. RA requires Document Reference; ITEM is used if present, or appended if absent. ICR requires SI No. (including S.I. #) and CODE. Column positions can vary by month. Sheets without compatible headers are listed as unavailable.

ICR header discovery is bounded to 30 rows before full parsing of compatible sheets, so unrelated overview sheets formatted to Excel's last row are skipped. Workbook parsing runs in a background worker to keep the screen responsive while large files load.

References match exact displayed text after trimming surrounding whitespace. Leading zeros and prefixes remain significant. Selected months are searched first. If an SI is absent from the selected months, the remaining compatible sheets in the whole ICR workbook are searched automatically. A valid selected-month match takes priority over codes elsewhere. Fallback matches show their actual source sheets and are labeled as found outside selected months. Repeated SI lines with one agreeing code are accepted. Conflicting codes or any blank code in the search scope, or blank RA references, require review; these are not bypassed by fallback. Matched rows replace existing ITEM values with the original ICR code. Other rows retain their ITEM values. No PO, date, or amount matching is inferred.

RA export follows the active status filter and search. Choose Matched to export matched references, or choose All and clear search to export all RA rows. Export includes every row in the filtered results, across all preview pages; the button shows the export row count and is disabled when no rows qualify. Other worksheets remain in the workbook.

Both result tables offer 15, 25, 50, 100, or All rows per page. Changing this selection returns to page 1 and affects the preview only.

The export edits the original XLSX archive directly rather than regenerating the workbook. Original fonts, fills, borders, alignment, number formats, column widths, row heights, page settings, themes, and unrelated workbook parts are preserved. Only matched ITEM values are replaced. Filtered exports remove excluded detail rows, compact remaining rows, and adjust worksheet ranges and formulas for deleted rows. Original uploads remain unchanged. ICR is used for lookup only and is never exported.

`src/lib/raMatching.js` owns RA/ICR parsing and matching. `src/lib/raExport.js` preserves source formatting and exports filtered rows. `src/components/RAWorkspace.jsx` owns the RA workflow screen. Tests cover matching, source-format preservation, filtered export, row compaction, formula/range changes, and literal text values.

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
