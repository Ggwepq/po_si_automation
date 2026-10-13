import {useRef, useState} from 'react';
import Icon from './Icon.jsx';

export default function UploadCard({kind, title, subtitle, data, busy, onUpload, compact = false}) {
  const input = useRef(null);
  const [dragging, setDragging] = useState(false);
  return <div className={`upload-card ${compact ? 'compact' : ''} ${dragging ? 'dragging' : ''} ${data ? 'loaded' : ''}`}
    onDragOver={e => {e.preventDefault(); setDragging(true);}}
    onDragLeave={() => setDragging(false)}
    onDrop={e => {e.preventDefault(); setDragging(false); if (!busy && e.dataTransfer.files[0]) onUpload(kind, e.dataTransfer.files[0]);}}>
    <input ref={input} type="file" accept=".xlsx" aria-label={`Upload ${title}`} disabled={busy} onChange={e => {if(e.target.files[0]) onUpload(kind, e.target.files[0]); e.target.value = '';}} />
    <button className="upload-button" disabled={busy} onClick={() => input.current.click()}>
      <span className="upload-icon"><Icon name={data ? 'file' : 'upload'} size={compact ? 18 : 26}/></span>
      <span className="upload-copy"><strong>{busy ? 'Reading workbook…' : compact && data ? data.fileName : title}</strong>
        {!compact && <><span className="upload-subtitle">{subtitle}</span><span className="select-file">{data ? data.fileName : 'Select file to upload'} {!data && <Icon name="arrow" size={15}/>}</span><span className="file-help">{data ? `${data.rows.length.toLocaleString()} item rows · Click to replace` : 'or drag and drop · .xlsx'}</span></>}
      </span>
      {compact && data && <Icon name="check" size={15}/>}
    </button>
  </div>;
}
