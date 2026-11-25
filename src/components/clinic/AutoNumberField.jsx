import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ListOrdered, X } from 'lucide-react';
import { API_BASE_URL } from '../../config';
import { useAuthStore } from '../../store/useAuthStore';
import { isSuperAdminUser, useBackDateStore } from './BackDateField';
import './AutoNumberField.scss';

// Auto Slip # / Admission # (owner, 2026-11-24). The server gives the number
// when the record is saved (a locked counter, so PCs saving at the same moment
// never get the same one); this field only shows the number the next save
// will get — read-only, refreshed every few seconds, on focus and after a
// save (bump `refreshKey`). The form keeps its own value blank, so the save
// asks for the next number, and the slip prints the number the save returns.
//
// Super Admin: the field can be typed into (blank = auto), and "Reserved"
// lists the numbers kept aside each shift, the back date's shift first.
const API = `${API_BASE_URL}/api/clinic`;
const LABEL = { slip: 'Slip #', admission: 'Admission #' };
const POLL_MS = 5000;

// The number the next save will get, or '' (offline for a moment — the field
// keeps the last number shown).
async function fetchNext(kind) {
  try {
    const res = await fetch(`${API}/numbers/next/${kind}`);
    const j = await res.json();
    return res.ok && j?.data?.number ? String(j.data.number) : '';
  } catch {
    return '';
  }
}

export default function AutoNumberField({ kind = 'slip', value = '', onChange, refreshKey = 0, className = '', style, inputProps = {} }) {
  const user = useAuthStore((s) => s.user);
  const superAdmin = isSuperAdminUser(user);
  const backDate = useBackDateStore((s) => s.value);
  const [next, setNext] = useState('');
  const [picking, setPicking] = useState(false);
  const [focusTick, setFocusTick] = useState(0);

  useEffect(() => {
    let live = true;
    const run = () => fetchNext(kind).then((n) => { if (live && n) setNext(n); });
    run();
    const t = setInterval(() => { if (!document.hidden) run(); }, POLL_MS);
    window.addEventListener('focus', run);
    return () => { live = false; clearInterval(t); window.removeEventListener('focus', run); };
  }, [kind, refreshKey, focusTick]);

  if (!superAdmin) {
    return (
      <input
        {...inputProps}
        className={`${className} anf-auto`}
        style={style}
        value={next}
        readOnly
        tabIndex={-1}
        title={`${LABEL[kind]} khud lagega — Save pe yahi (ya agla) number milega`}
      />
    );
  }

  return (
    <>
      <input
        {...inputProps}
        className={`${className} anf-sa`}
        style={style}
        value={value}
        placeholder={next}
        onChange={(e) => onChange?.(e.target.value.trim())}
        onFocus={() => setFocusTick((t) => t + 1)}
        title={`Khali chhorein to ${LABEL[kind]} khud lagega (${next || '…'}). Reserved number ke liye list kholein.`}
      />
      <button type="button" className="anf-pick" onClick={() => setPicking(true)} title={`Reserved ${LABEL[kind]} — list`}>
        <ListOrdered size={13} />
      </button>
      {picking && (
        <ReservedPicker
          kind={kind}
          backDate={backDate}
          onClose={() => setPicking(false)}
          onPick={(n) => { onChange?.(String(n)); setPicking(false); }}
        />
      )}
    </>
  );
}

const fmtDate = (s) => {
  const [y, m, d] = String(s || '').split('-');
  return y ? `${d}-${m}-${y}` : '';
};

function ReservedPicker({ kind, backDate, onClose, onPick }) {
  const [rows, setRows] = useState(null);
  const [shift, setShift] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    const qs = new URLSearchParams({ kind, status: 'free' });
    if (backDate) qs.set('backDate', new Date(backDate).toISOString());
    fetch(`${API}/numbers/reserved?${qs}`)
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (!live) return;
        if (!ok) { setError(j?.message || 'List nahi khuli'); setRows([]); return; }
        setRows(j.data?.rows || []);
        setShift(j.data?.backDateShift || null);
      })
      .catch(() => { if (live) { setError('Server se rabta nahi'); setRows([]); } });
    return () => { live = false; };
  }, [kind, backDate]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  return createPortal(
    <div className="anf-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="anf-modal" role="dialog" aria-modal="true" aria-label={`Reserved ${LABEL[kind]}`}>
        <div className="anf-modal__head">
          <strong>Reserved {LABEL[kind]}</strong>
          <button type="button" className="anf-modal__close" onClick={onClose} aria-label="Band karein"><X size={16} /></button>
        </div>
        <p className="anf-modal__hint">
          {shift
            ? <>Back date ki shift (<b>{fmtDate(shift.date)}, {shift.name}</b>) ke number upar hain.</>
            : <>Back date lagayein to us din / shift ke number upar aa jayenge.</>}
          {' '}Number pe click karein.
        </p>
        {error && <p className="anf-modal__error">{error}</p>}
        <div className="anf-modal__body">
          {rows === null ? (
            <p className="anf-modal__empty">Load ho raha hai…</p>
          ) : rows.length === 0 ? (
            <p className="anf-modal__empty">Koi reserved number khali nahi.</p>
          ) : (
            <table className="anf-table">
              <thead><tr><th>{LABEL[kind]}</th><th>Date</th><th>Shift</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className={r.matchesBackDate ? 'is-match' : ''} onClick={() => onPick(r.number)} tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onPick(r.number); } }}>
                    <td className="anf-num">{r.number}</td>
                    <td>{fmtDate(r.shiftDate)}</td>
                    <td>{r.shiftName || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
