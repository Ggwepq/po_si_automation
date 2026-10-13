import Icon from './Icon.jsx';
export default function InvoiceWorkspace({results}) {
  const delivered = [...new Map(results.filter(r => r.status === 'Delivered').map(r => [r.poNumber, r])).values()];
  return <section className="invoice-workspace"><div className="section-heading"><div><p className="eyebrow">NEXT STEP</p><h2>Sales invoices</h2><p>Prepare invoices for delivered purchase orders.</p></div><span className="pending-tag"><Icon name="clock" size={15}/> Awaiting template</span></div>
    <div className="invoice-paper"><div className="paper-heading"><span>SALES INVOICE</span><span className="muted">Template pending</span></div><div className="invoice-placeholder"><Icon name="file" size={34}/><h3>Your invoice workspace</h3><p>Sales invoice generation will be available once the invoice format is supplied.</p></div>
      <div className="invoice-po-list"><strong>Delivered POs · {delivered.length}</strong>{delivered.length ? delivered.map(r => <div key={r.poNumber}><span className="identifier">{r.poNumber}</span><span>{r.vendorName}</span></div>) : <p>No delivered POs in the current comparison.</p>}</div>
    </div><p className="invoice-note">Portal exports need a confirmed GR number, SI number, invoice date, and invoice amount. Receipt No. has not yet been mapped to GR No.</p><div className="actions"><button disabled>Generate Outright Submit Invoice</button><button disabled>Generate Outright SCR</button></div>
  </section>;
}
