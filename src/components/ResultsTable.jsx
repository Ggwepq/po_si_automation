import {useState} from 'react';
import Icon from './Icon.jsx';
import TablePagination from './TablePagination.jsx';

function DetailRow({result}) {
  const [open, setOpen] = useState(false);
  return <><tr>
    <td><button className={`row-expand ${open ? 'open' : ''}`} aria-expanded={open} aria-label={`${open ? 'Hide' : 'Show'} item details for ${result.poNumber || 'blank PO'}`} onClick={() => setOpen(!open)}><Icon name="chevron" size={14}/></button><span className="identifier">{result.poNumber || 'Missing PO number'}</span></td>
    <td className="identifier muted">{result.grPO || '—'}</td><td>{result.vendorCode || '—'}</td><td>{result.vendorName || '—'}</td>
    <td><span className={`status ${result.status.toLowerCase().replaceAll(' ', '-')}`}><span className="status-dot"/>{result.status}</span></td>
  </tr>{open && <tr className="detail-row"><td colSpan="5"><div className="receipt-detail">Matched receipt numbers: <strong>{result.receiptNumbers.join(', ') || 'None'}</strong></div><dl>{Object.entries(result.original).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{String(value || '—')}</dd></div>)}</dl></td></tr>}</>;
}

export default function ResultsTable({rows, page, setPage, totalRows}) {
  const [pageSize, setPageSize] = useState(15);
  const size = pageSize === 'all' ? Math.max(1, rows.length) : pageSize;
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const currentPage = Math.min(page, pages);
  const visible = rows.slice((currentPage - 1) * size, currentPage * size);
  return <><div className="table-scroll"><table><thead><tr><th>PO No.</th><th>Matched GR PO No.</th><th>Vendor code</th><th>Vendor name</th><th>Remarks</th></tr></thead>
    <tbody>{visible.map(row => <DetailRow key={row.id} result={row}/>)}{!visible.length && <tr><td colSpan="5" className="empty-table">No item rows match your search or filter.</td></tr>}</tbody></table></div>
    <TablePagination count={rows.length} totalCount={totalRows} page={currentPage} pages={pages} pageSize={pageSize} setPage={setPage} onPageSizeChange={value => {setPageSize(value); setPage(1);}} label="PO rows per page"/>
  </>;
}
