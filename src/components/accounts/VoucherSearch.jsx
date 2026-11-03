import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Binoculars } from 'lucide-react';
import toast from 'react-hot-toast';
import { listExpenseVouchers } from './voucherSearchApi';
import './VoucherSearch.scss';

const fmtDate = (d) => new Date(d).toLocaleDateString('en-GB');
const PANEL_MIN_WIDTH = 480;

// Voucher # search (owner, 2026-11-03). A binoculars button inside the input
// it wraps lists every saved Expense voucher of the book — newest first,
// with Main GL, type, lines and total — and typing narrows it by number,
// date or Main GL. What a pick does is up to the page: onSelect(row) gets
// the list row (fetchExpenseVoucher in ./voucherSearchApi loads it in full);
// returning false keeps the list open.
//
//   <VoucherSearch entityType={entityType} onSelect={(row) => …}>
//     <input value={voucherNo} readOnly />
//   </VoucherSearch>
//
// `disabled` leaves just the input, without the button. The list opens on
// a layer of its own (portal), so a report card that clips its content or
// a narrow filter box doesn't cut it.
export default function VoucherSearch({ entityType, onSelect, disabled = false, children }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [list, setList] = useState(null); // null = loading
  const [busy, setBusy] = useState(false);
  const [pos, setPos] = useState(null);
  const rootRef = useRef(null);
  const panelRef = useRef(null);

  // Under the input, at least PANEL_MIN_WIDTH wide, kept inside the window.
  useLayoutEffect(() => {
    if (!open) return undefined;
    const place = () => {
      const r = rootRef.current?.getBoundingClientRect();
      if (!r) return;
      const width = Math.min(Math.max(r.width, PANEL_MIN_WIDTH), window.innerWidth - 16);
      const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
      setPos({ top: r.bottom + 4, left, width });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);

  // A click anywhere else closes it.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (rootRef.current?.contains(e.target) || panelRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // Loaded again each time it opens, so a voucher saved meanwhile shows.
  const toggle = async () => {
    if (open) { setOpen(false); return; }
    setOpen(true);
    try {
      setList(await listExpenseVouchers(entityType));
    } catch {
      setList([]);
      toast.error('Vouchers load nahi hue');
    }
  };

  const q = query.trim().toUpperCase();
  const matches = (list || []).filter((v) => !q
    || String(v.voucherNo).toUpperCase().includes(q)
    || fmtDate(v.voucherDate).includes(q)
    || String(v.mainGl || '').toUpperCase().includes(q));

  const pick = async (row) => {
    if (busy) return;
    setBusy(true);
    try {
      if ((await onSelect?.(row)) !== false) {
        setOpen(false);
        setQuery('');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div ref={rootRef} className={`vsrch${disabled ? '' : ' vsrch--on'}`}>
      {children}
      {!disabled && (
        <button
          type="button"
          className={`vsrch__btn${open ? ' active' : ''}`}
          onClick={toggle}
          title="Bana hua voucher dhoondein"
          aria-label="Search vouchers"
          aria-expanded={open}
        >
          <Binoculars size={16} />
        </button>
      )}
      {open && pos && createPortal(
        <div ref={panelRef} className="vsrch__panel" style={{ top: pos.top, left: pos.left, width: pos.width }}>
          <input
            className="vsrch__input"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } }}
            placeholder="Voucher #, date ya Main GL se dhoondein"
          />
          {list === null ? (
            <div className="vsrch__hint">Vouchers load ho rahe hain…</div>
          ) : busy ? (
            <div className="vsrch__hint">Voucher khul raha hai…</div>
          ) : matches.length === 0 ? (
            <div className="vsrch__hint">Koi voucher nahi mila</div>
          ) : matches.map((v) => (
            <button type="button" key={v.id} className="vsrch__item" onClick={() => pick(v)}>
              <span className="vsrch__code">{v.voucherNo}</span>
              <span className="vsrch__date">{fmtDate(v.voucherDate)}</span>
              <span className="vsrch__gl" title={v.mainGl || ''}>{v.mainGl || '—'}</span>
              <span className="vsrch__meta">{v.voucherType || ''} · {v.lineCount} line{v.lineCount === 1 ? '' : 's'} · Rs {Number(v.total || 0).toLocaleString()}</span>
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}
