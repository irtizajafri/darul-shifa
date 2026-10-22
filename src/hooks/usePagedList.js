import { useState } from 'react';
import { flushSync } from 'react-dom';

export const PAGE_SIZE = 300;

// On-screen paging for very large report lists (owner's hang report,
// 2026-10-22: 7k–84k rows rendered at once froze the app for seconds).
// Only how many rows are DRAWN is limited — totals, print and Excel export
// keep working off the full data.
//
//   const page = usePagedList(total, resetKey);
//   rows.slice(0, page.limit) …  <ShowMoreFooter {...page} />
//
// `resetKey` — anything that changes when the data or a filter changes
// (the fetched array itself, a filter string…); the list drops back to the
// first page then. Compared with ===, checked during render (no effect, so
// no extra paint of the old page).
//
// Printing a report that clones its on-screen DOM (printElementInPopup) must
// still print every row: `page.withAll(fn)` synchronously renders ALL rows
// (flushSync), runs fn (the clone/print) and then goes back to the paged
// view — the full list is never painted on screen. Call it from the click
// handler itself so the print window opens inside the user gesture.
export default function usePagedList(total, resetKey, pageSize = PAGE_SIZE) {
  const [state, setState] = useState({ key: resetKey, limit: pageSize });
  const [all, setAll] = useState(false);
  const limit = all ? Infinity : state.key === resetKey ? state.limit : pageSize;
  return {
    limit,
    shown: Math.min(limit, total),
    total,
    pageSize,
    showMore: () => setState({ key: resetKey, limit: limit + pageSize }),
    showAll: () => setState({ key: resetKey, limit: Infinity }),
    withAll: (fn) => {
      flushSync(() => setAll(true));
      try { return fn(); } finally { setAll(false); }
    },
  };
}
