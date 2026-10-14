export default function TablePagination({count, totalCount = count, page, pages, pageSize, setPage, onPageSizeChange, label = 'Rows per page'}) {
  const size = pageSize === 'all' ? Math.max(1, count) : pageSize;
  return <div className="table-footer"><span>{count ? `${(page - 1) * size + 1}–${Math.min(page * size, count)} of ${count}` : '0'} rows{count !== totalCount ? ` · ${totalCount} total` : ''}</span><div className="pagination">
    <label className="page-size">Rows per page <select aria-label={label} value={pageSize} onChange={e => onPageSizeChange(e.target.value === 'all' ? 'all' : Number(e.target.value))}>{[15, 25, 50, 100].map(size => <option key={size} value={size}>{size}</option>)}<option value="all">All</option></select></label>
    <button disabled={page === 1} onClick={() => setPage(page - 1)} aria-label="Previous page">←</button><span>{page} / {pages}</span><button disabled={page >= pages} onClick={() => setPage(page + 1)} aria-label="Next page">→</button>
  </div></div>;
}
