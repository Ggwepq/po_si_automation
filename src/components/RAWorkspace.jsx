import {useMemo, useRef, useState} from 'react';
import UploadCard from './UploadCard.jsx';
import Icon from './Icon.jsx';
import {readRAWorkbook, matchRA} from '../lib/raMatching.js';
import {exportRA} from '../lib/raExport.js';

async function readUploadedWorkbook(file, kind) {
  if (!/\.xlsx$/i.test(file.name)) throw new Error('Please select an .xlsx workbook.');
  if (file.size > 100 * 1024 * 1024) throw new Error('Please use a workbook smaller than 100 MB.');
  if (typeof Worker === 'undefined') return readRAWorkbook(file, kind);
  const bytes = await file.arrayBuffer();
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../lib/raWorkbookWorker.js', import.meta.url), {type: 'module'});
    worker.onmessage = ({data}) => {worker.terminate(); if (data.error) reject(new Error(data.error)); else resolve(data.result);};
    worker.onerror = () => {worker.terminate(); reject(new Error('The workbook could not be processed. Try a smaller workbook or reload the app.'));};
    worker.postMessage({bytes, kind, name: file.name, size: file.size}, [bytes]);
  });
}

export default function RAWorkspace() {
  const [files, setFiles] = useState({ra: null, icr: null});
  const [busy, setBusy] = useState({ra: false, icr: false});
  const [error, setError] = useState('');
  const [sheetName, setSheetName] = useState('');
  const [months, setMonths] = useState([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const [page, setPage] = useState(1);
  const versions = useRef({ra: 0, icr: 0});
  const processing = busy.ra || busy.icr;
  const raSheet = files.ra?.sheets.find(s => s.sheetName === sheetName);
  const ready = !!(raSheet && files.icr && months.length);
  const results = useMemo(() => ready ? matchRA(raSheet, files.icr.sheets, months) : [], [raSheet, files.icr, months, ready]);
  const counts = useMemo(() => ({matched: results.filter(r => r.status === 'Matched').length, fallback: results.filter(r => r.status === 'Matched' && r.fallback).length, unmatched: results.filter(r => r.status === 'Not matched').length, review: results.filter(r => r.status === 'Needs review').length}), [results]);
  const filtered = useMemo(() => results.filter(row => (filter === 'All' || row.status === filter) && [row.reference, row.code, row.existingItem, row.reason, ...row.months].some(value => value.toLowerCase().includes(query.toLowerCase().trim()))), [results, query, filter]);
  const pages = Math.max(1, Math.ceil(filtered.length / 15));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice((currentPage - 1) * 15, currentPage * 15);
  const resetFilters = () => {setQuery(''); setFilter('All'); setPage(1);};
  async function upload(kind, file) {
    const version = ++versions.current[kind];
    setBusy(b => ({...b, [kind]: true})); setError('');
    try {
      const data = await readUploadedWorkbook(file, kind);
      if (version !== versions.current[kind]) return;
      setFiles(f => ({...f, [kind]: data}));
      if (kind === 'ra') setSheetName(data.sheets[0].sheetName);
      if (kind === 'icr') setMonths([]);
      resetFilters();
    } catch (e) {if (version === versions.current[kind]) setError(`${kind === 'ra' ? 'RA_DETAIL' : 'ICR'} upload: ${e.message}`);}
    finally {if (version === versions.current[kind]) setBusy(b => ({...b, [kind]: false}));}
  }
  function reset() {
    versions.current.ra++; versions.current.icr++;
    setFiles({ra: null, icr: null}); setBusy({ra: false, icr: false}); setSheetName(''); setMonths([]); setError(''); resetFilters();
  }
  function toggleMonth(name) {setMonths(selected => selected.includes(name) ? selected.filter(m => m !== name) : [...selected, name]); resetFilters();}
  function download() {try {exportRA(files.ra, raSheet, results, filtered, filter);} catch (e) {setError(`Could not export the workbook: ${e.message}`);}}
  return <div className="page"><main className="workspace ra-workspace">
    <header className="workspace-header"><div><p className="eyebrow">RA_DETAIL & ICR</p><h1>RA item matching</h1><p className="intro">Fill ITEM using the code of each matching sales invoice.</p></div><button className="text-button" onClick={reset}>Start over</button></header>
    {error && <div className="error-banner" role="alert"><span>{error}</span><button onClick={() => setError('')} aria-label="Dismiss error"><Icon name="close" size={16}/></button></div>}
    <section className="ra-inputs"><div className="upload-step"><span>01</span> UPLOAD YOUR WORKBOOKS</div><div className="upload-pair"><UploadCard kind="ra" title="RA_DETAIL" subtitle="Document Reference and ITEM" data={files.ra} busy={busy.ra} onUpload={upload}/><span className="upload-connector"><Icon name="arrow" size={24}/></span><UploadCard kind="icr" title="ICR workbook" subtitle="Monthly SI numbers and codes" data={files.icr} busy={busy.icr} onUpload={upload}/></div></section>
    {files.ra && <div className="ra-sheet-setting"><label>RA worksheet <select value={sheetName} disabled={processing} onChange={e => {setSheetName(e.target.value); resetFilters();}}>{files.ra.sheets.map(s => <option key={s.sheetName}>{s.sheetName}</option>)}</select></label><span>{raSheet?.rows.length.toLocaleString()} detail rows{raSheet && !raSheet.hasItem ? ' · ITEM column will be added' : ''}</span></div>}
    {files.icr && <section className="month-section"><div className="section-heading"><div><p className="eyebrow">02 SELECT ICR MONTHS</p><h2>Where should we look?</h2><p>Choose one or more month worksheets to compare.</p></div><button className="text-button" disabled={processing} onClick={() => {setMonths(months.length === files.icr.sheets.length ? [] : files.icr.sheets.map(s => s.sheetName)); resetFilters();}}>{months.length === files.icr.sheets.length ? 'Clear selection' : 'Select all months'}</button></div>
      <p className="selection-hint">Selected months are checked first. Missing SI numbers are then searched across the rest of the ICR workbook.</p>
      <div className="month-options">{files.icr.sheets.map(s => <label key={s.sheetName} className={months.includes(s.sheetName) ? 'selected' : ''}><input type="checkbox" checked={months.includes(s.sheetName)} disabled={processing} onChange={() => toggleMonth(s.sheetName)}/><span>{s.sheetName}</span></label>)}</div>
      {!months.length && <p className="selection-hint" role="status">Select at least one month to see matching results.</p>}
      {!!files.icr.skippedSheets.length && <details className="column-settings"><summary>{files.icr.skippedSheets.length} worksheet(s) unavailable for comparison</summary><ul>{files.icr.skippedSheets.map(s => <li key={s.name}>{s.reason}</li>)}</ul></details>}
    </section>}
    {ready && <section className="results-section" aria-busy={processing}><div className="section-heading"><div><p className="eyebrow">03 REVIEW & EXPORT</p><h2>Item matching results</h2><p>{months.length} selected month{months.length === 1 ? '' : 's'} · {results.length.toLocaleString()} RA rows</p></div><span className="local-tag"><span/> Processed locally</span></div>
      {processing && <p className="match-note" role="status">Reading replacement workbook…</p>}
      <div className="stat-grid"><div><span><i className="green-dot"/>Matched</span><strong>{counts.matched.toLocaleString()}</strong><small>{counts.fallback.toLocaleString()} found outside selected months</small></div><div><span><i className="amber-dot"/>Not matched</span><strong>{counts.unmatched.toLocaleString()}</strong><small>No SI anywhere in ICR</small></div><div><span>Needs review</span><strong>{counts.review.toLocaleString()}</strong><small>Blank reference or unclear code</small></div></div>
      <p className="match-note">Matched rows replace the existing ITEM with the ICR code. Unmatched rows and rows needing review keep their existing ITEM. Selected months take priority. A match outside those months is labeled in the reason below.</p>
      <div className="table-toolbar"><div className="filter-tabs" aria-label="RA matching status filter">{['All', 'Matched', 'Not matched', 'Needs review'].map(f => <button key={f} className={filter === f ? 'selected' : ''} onClick={() => {setFilter(f); setPage(1);}}>{f}</button>)}</div><label className="search-box"><Icon name="search" size={17}/><input aria-label="Search document reference or code" placeholder="Search SI number or code…" value={query} onChange={e => {setQuery(e.target.value); setPage(1);}}/></label></div>
      <div className="table-scroll"><table><thead><tr><th>RA row</th><th>Document Reference</th><th>Current ITEM</th><th>Updated ITEM</th><th>ICR month</th><th>Status / reason</th></tr></thead><tbody>{visible.map(row => <tr key={row.rowIndex}><td>{row.rowIndex + 1}</td><td className="identifier">{row.reference || '—'}</td><td>{row.existingItem || '—'}</td><td><strong>{row.outputItem || '—'}</strong></td><td>{row.months.join(', ') || '—'}</td><td><span className={`status ${row.status === 'Matched' ? 'delivered' : row.status === 'Not matched' ? 'undelivered' : 'needs-review'}`}>{row.status}</span><span className="ra-reason">{row.reason}</span></td></tr>)}{!visible.length && <tr><td colSpan="6" className="empty-table">No rows match your search or filter.</td></tr>}</tbody></table></div>
      <div className="table-footer"><span>{filtered.length ? `${(currentPage - 1) * 15 + 1}–${Math.min(currentPage * 15, filtered.length)} of ${filtered.length}` : '0'} rows</span><div className="pagination"><button disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} aria-label="Previous RA page">←</button><span>Page {currentPage} of {pages}</span><button disabled={currentPage >= pages} onClick={() => setPage(currentPage + 1)} aria-label="Next RA page">→</button></div></div>
      <footer className="results-actions"><p>Export {filtered.length.toLocaleString()} rows · {filter}{query.trim() ? ' · search applied' : ''}<br/><span>Original formatting retained. Select All and clear search to export every row.</span></p><div className="actions"><button className="primary" disabled={processing || !filtered.length} onClick={download}><Icon name="download" size={17}/> Export {filter === 'All' && !query.trim() ? 'all' : 'filtered'} rows ({filtered.length.toLocaleString()})</button></div></footer>
    </section>}
  </main></div>;
}
