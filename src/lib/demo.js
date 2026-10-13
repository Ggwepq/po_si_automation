// Synthetic examples only. Customer workbooks are never bundled into the website.
export function demoWorkbooks() {
  const headers = ['PO No.', 'Vendor Code', 'Vendor Name', 'Company Name', 'Site Name', 'Article Code', 'Description', 'Qty', 'Amount'];
  const rows = [
    ['DEMO-PO-001', '150551', 'OROZA ENTERPRISES', 'SVI', 'Example branch A', 'DEMO-01', 'Example product A', '2', '1,000.00'],
    ['DEMO-PO-001', '150551', 'OROZA ENTERPRISES', 'SVI', 'Example branch A', 'DEMO-02', 'Example product B', '1', '500.00'],
    ['DEMO-PO-002', '150551', 'OROZA ENTERPRISES', 'SMCo', 'Example branch B', 'DEMO-01', 'Example product A', '3', '1,500.00'],
    ['DEMO-PO-003', '150551', 'OROZA ENTERPRISES', 'SSM', 'Example branch C', 'DEMO-03', 'Example product C', '1', '750.00'],
  ].map(values => Object.fromEntries(headers.map((h, i) => [h, values[i]])));
  return {
    po: {fileName: 'Demo PO Details.xlsx', sheetName: 'Demo', poColumn: 'PO No.', headers, rows},
    gr: {fileName: 'Demo GR Details.xlsx', sheetName: 'Demo', poColumn: 'PO No.', headers: ['PO No.', 'Receipt No.'], rows: [{'PO No.': 'DEMO-PO-001', 'Receipt No.': 'DEMO-RECEIPT-001'}, {'PO No.': 'DEMO-PO-003', 'Receipt No.': 'DEMO-RECEIPT-003'}]},
  };
}
