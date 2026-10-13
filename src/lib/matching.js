export const normalizePO = value => String(value ?? '').trim();
export const isPOHeader = value => /^po\s*(no\.?|number)$/i.test(String(value ?? '').trim());

export function compareWorkbooks(po, gr) {
  const receipts = new Map();
  for (const row of gr.rows) {
    const key = normalizePO(row[gr.poColumn]);
    if (!key) continue;
    if (!receipts.has(key)) receipts.set(key, []);
    receipts.get(key).push(row);
  }
  return po.rows.map((row, index) => {
    const key = normalizePO(row[po.poColumn]);
    const matches = key ? receipts.get(key) ?? [] : [];
    const receiptColumn = gr.headers.find(h => /^receipt\s*no\.?$/i.test(h));
    return {
      id: index, original: row, poNumber: key,
      grPO: matches.length ? key : '',
      receiptNumbers: [...new Set(matches.map(r => normalizePO(r[receiptColumn])).filter(Boolean))],
      vendorCode: row['Vendor Code'] ?? '', vendorName: row['Vendor Name'] ?? '',
      status: !key ? 'Needs review' : matches.length ? 'Delivered' : 'Undelivered',
    };
  });
}

export function summarize(results, gr) {
  const unique = new Map();
  results.filter(r => r.poNumber).forEach(r => unique.set(r.poNumber, r.status));
  const grKeys = new Set(gr.rows.map(r => normalizePO(r[gr.poColumn])).filter(Boolean));
  return {
    total: unique.size,
    delivered: [...unique.values()].filter(s => s === 'Delivered').length,
    undelivered: [...unique.values()].filter(s => s === 'Undelivered').length,
    review: results.filter(r => r.status === 'Needs review').length,
    unmatchedGR: [...grKeys].filter(k => !unique.has(k)).length,
  };
}
