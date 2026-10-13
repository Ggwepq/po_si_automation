import {useState} from 'react';
import Icon from './Icon.jsx';

function DetailRow({result}) {
  const [open, setOpen] = useState(false);
  return <><tr>
    <td><button className={`row-expand ${open ? 'open' : ''}`} aria-expanded={open} aria-label={`${open ? 'Hide' : 'Show'} item details for ${result.poNumber || 'blank PO'}`} onClick={() => setOpen(!open)}><Icon name="chevron" size={14}/></button><span className="identifier">{result.poNumber || 'Missing PO number'}</span></td>
    <td className="identifier muted">{result.grPO || '—'}</td><td>{result.vendorCode || '—'}</td><td>{result.vendorName || '—'}</td>
    <td><span className={`status ${result.status.toLowerCase().replaceAll(' ', '-')}`}><span className="status-dot"/>{result.status}</span></td>
  </tr>{open && <tr className="detail-row"><td colSpan="5"><div className="receipt-detail">Matched receipt numbers: <strong>{result.receiptNumbers.join(', ') || 'None'}</strong></div><dl>{Object.entries(result.original).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{String(value || '—')}</dd></div>)}</dl></td></tr>}</>;
}

export default function ResultsTable({rows, page, setPage, totalRows}) {
  const pageSize = 15;
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const visible = rows.slice((page - 1) * pageSize, page * pageSize);
  return <><div className="table-scroll"><table><thead><tr><th>PO No.</th><th>Matched GR PO No.</th><th>Vendor code</th><th>Vendor name</th><th>Remarks</th></tr></thead>
    <tbody>{visible.map(row => <DetailRow key={row.id} result={row}/>)}{!visible.length && <tr><td colSpan="5" className="empty-table">No item rows match your search or filter.</td></tr>}</tbody></table></div>
    <div className="table-footer"><span>{rows.length ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, rows.length)} of ${rows.length}` : '0'} item rows{rows.length !== totalRows ? ` · ${totalRows} total` : ''}</span><div className="pagination"><button disabled={page === 1} onClick={() => setPage(page - 1)} aria-label="Previous page">←</button><span>Page {page} of {pages}</span><button disabled={page >= pages} onClick={() => setPage(page + 1)} aria-label="Next page">→</button></div></div>
  </>;
}
