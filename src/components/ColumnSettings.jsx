export default function ColumnSettings({po, gr, onChange}) {
  return <details className="column-settings"><summary>Workbook settings</summary><div className="settings-grid">
    {[['po', po, 'PO details'], ['gr', gr, 'GR details']].map(([kind, data, label]) => <div key={kind}><strong>{label}</strong>
      {data.workbook ? <><label>Worksheet<select value={data.sheetName} onChange={e => onChange(kind, e.target.value)}>{data.workbook.SheetNames.map(n => <option key={n}>{n}</option>)}</select></label>
      <label>PO number column<select value={data.poColumn} onChange={e => onChange(kind, data.sheetName, e.target.value)}>{data.headers.map(h => <option key={h}>{h}</option>)}</select></label></> : <p>Synthetic demo data</p>}
    </div>)}
  </div></details>;
}
