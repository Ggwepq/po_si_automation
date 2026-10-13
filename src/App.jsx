import {useMemo, useRef, useState} from 'react';
import UploadCard from './components/UploadCard.jsx';
import Icon from './components/Icon.jsx';
import ResultsTable from './components/ResultsTable.jsx';
import InvoiceWorkspace from './components/InvoiceWorkspace.jsx';
import ColumnSettings from './components/ColumnSettings.jsx';
import {readWorkbook, parseSheet, exportResults} from './lib/workbooks.js';
import {compareWorkbooks, summarize} from './lib/matching.js';
import {demoWorkbooks} from './lib/demo.js';

export default function App() {
  const [files, setFiles] = useState({po: null, gr: null});
  const [busy, setBusy] = useState({po: false, gr: false});
  const [error, setError] = useState('');
  const [demo, setDemo] = useState(false);
  const [view, setView] = useState('results');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const [page, setPage] = useState(1);
  const versions = useRef({po: 0, gr: 0});
  const ready = !!(files.po && files.gr);
  const processing = busy.po || busy.gr;
  const results = useMemo(() => ready ? compareWorkbooks(files.po, files.gr) : [], [files, ready]);
  const counts = useMemo(() => ready ? summarize(results, files.gr) : null, [results, files.gr, ready]);
  const filtered = useMemo(() => results.filter(r => (filter === 'All' || r.status === filter) && [r.poNumber, r.grPO, r.vendorCode, r.vendorName, ...r.receiptNumbers].some(v => String(v).toLowerCase().includes(query.toLowerCase().trim()))), [results, filter, query]);
  const resetFilters = () => {setPage(1); setQuery(''); setFilter('All');};
  async function upload(kind, file) {
    const version = ++versions.current[kind];
    setBusy(b => ({...b, [kind]: true})); setError('');
    try {
      const data = await readWorkbook(file);
      if (version !== versions.current[kind]) return;
      setFiles(f => demo ? {[kind]: data, [kind === 'po' ? 'gr' : 'po']: null} : {...f, [kind]: data});
      setDemo(false); setView('results'); resetFilters();
    } catch(e) {if (version === versions.current[kind]) setError(`${kind === 'po' ? 'PO' : 'GR'} upload: ${e.message}`);}
    finally {if (version === versions.current[kind]) setBusy(b => ({...b, [kind]: false}));}
  }
  function changeColumns(kind, sheet, column) {
    try {const data = parseSheet(files[kind].workbook, sheet, column); setFiles(f => ({...f, [kind]: {...f[kind], ...data}})); setError(''); resetFilters();}
    catch(e) {setError(e.message);}
  }
  function reset() {versions.current.po++; versions.current.gr++; setFiles({po:null,gr:null}); setBusy({po:false,gr:false}); setError(''); setDemo(false); setView('results'); resetFilters();}
  function download() {try {exportResults(results, files.po.headers);} catch(e) {setError(`Could not export the workbook: ${e.message}`);}}
  return <div className="page">
    <main className={`workspace ${ready ? 'has-results' : ''}`}>
      <header className={`workspace-header ${!ready ? 'initial' : ''}`}>
        {ready && <div className="file-pair"><UploadCard kind="po" title="PO Details" data={files.po} busy={busy.po} onUpload={upload} compact/><span className="pair-line"/><UploadCard kind="gr" title="GR Details" data={files.gr} busy={busy.gr} onUpload={upload} compact/></div>}
      </header>
      {error && <div className="error-banner" role="alert"><span>{error}</span><button onClick={() => setError('')} aria-label="Dismiss error"><Icon name="close" size={16}/></button></div>}
      {!ready ? <section className="upload-section"><div className="upload-step"><span>01</span> UPLOAD YOUR WORKBOOKS</div><div className="upload-pair"><UploadCard kind="po" title="PO Details" subtitle="Your purchase orders" data={files.po} busy={busy.po} onUpload={upload}/><span className="upload-connector"><Icon name="arrow" size={24}/></span><UploadCard kind="gr" title="GR Details" subtitle="Your goods receipts" data={files.gr} busy={busy.gr} onUpload={upload}/></div>
              </section> : <>
        <nav className="view-tabs" aria-label="Workflow views"><button className={view === 'results' ? 'active' : ''} onClick={() => setView('results')}><span>01</span> Remarks checker</button><button className={view === 'invoices' ? 'active' : ''} onClick={() => setView('invoices')}><span>02</span> Sales invoices <span className="tab-pending">Pending</span></button><button className="start-over" disabled={processing} onClick={reset}>Start over</button></nav>
        {demo && <div className="demo-banner">Demo preview · These are synthetic examples. Upload your files to compare actual POs.</div>}
        {processing && <div className="demo-banner" role="status">Reading replacement workbook…</div>}
        {view === 'results' ? <section className="results-section"><div className="section-heading"><div><h2>Remarks checker</h2><p>Delivery status, matched against your goods receipts.</p></div><span className="local-tag"><span/> Processed locally</span></div>
          <div className="stat-grid"><div><span>Total POs</span><strong>{counts.total.toLocaleString()}</strong><small>{results.length.toLocaleString()} item rows</small></div><div><span><i className="green-dot"/>Delivered</span><strong>{counts.delivered.toLocaleString()}</strong><small>PO number found in GR</small></div><div><span><i className="amber-dot"/>Undelivered</span><strong>{counts.undelivered.toLocaleString()}</strong><small>No match in uploaded GR</small></div></div>
          {counts.unmatchedGR > 0 && <p className="match-note">{counts.unmatchedGR} PO number{counts.unmatchedGR === 1 ? '' : 's'} in GR {counts.unmatchedGR === 1 ? 'is' : 'are'} absent from the PO upload. {counts.delivered === 0 && 'No PO numbers match between these files.'}</p>}
          {counts.review > 0 && <p className="match-note">{counts.review} item rows have a blank PO number and need review.</p>}
          <div className="table-toolbar"><div className="filter-tabs" aria-label="Delivery status filter">{['All', 'Delivered', 'Undelivered', ...(counts.review ? ['Needs review'] : [])].map(f => <button key={f} className={filter === f ? 'selected' : ''} onClick={() => {setFilter(f); setPage(1);}}>{f}</button>)}</div><label className="search-box"><Icon name="search" size={17}/><input aria-label="Search PO, vendor, or receipt" placeholder="Search PO or vendor…" value={query} onChange={e => {setQuery(e.target.value); setPage(1);}}/></label></div>
          <ResultsTable rows={filtered} page={page} setPage={setPage} totalRows={results.length}/><ColumnSettings po={files.po} gr={files.gr} onChange={changeColumns}/>
          <footer className="results-actions"><p>Any PO match marks the PO delivered.<br/><span>Quantity and partial delivery are not checked.</span></p><div className="actions"><button disabled title="Sales invoice template is required">Generate SI</button><button className="primary" disabled={processing} onClick={download}><Icon name="download" size={17}/> Export to xlsx</button></div></footer><p className="export-note">Export includes all {results.length} item rows and the original PO columns, regardless of filters. Sales invoice generation is awaiting your template.</p>
        </section> : <InvoiceWorkspace results={results}/>}
      </>}
    </main>
  </div>;
}
