import './ShowMoreFooter.scss';

const n = (v) => Number(v).toLocaleString('en');

// "Showing 300 of 11,093 — Show more (next 300) / Show all" under a paged
// report list (see hooks/usePagedList.js). Renders nothing once everything
// is shown, and never prints (.no-print).
export default function ShowMoreFooter({ shown, total, pageSize, showMore, showAll, noun = '' }) {
  if (shown >= total) return null;
  const next = Math.min(pageSize, total - shown);
  return (
    <div className="rpt-more no-print">
      <span>Showing {n(shown)} of {n(total)}{noun ? ` ${noun}` : ''}</span>
      <span className="rpt-more-sep">—</span>
      <button type="button" className="rpt-more-btn" onClick={showMore}>Show more (next {n(next)})</button>
      <span className="rpt-more-sep">/</span>
      <button type="button" className="rpt-more-btn" onClick={showAll}>Show all</button>
    </div>
  );
}
