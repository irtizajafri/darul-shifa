import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Copy, Eye, ExternalLink, FileText, KeyRound, Lock, RefreshCw, Upload, X } from 'lucide-react';
import toast from 'react-hot-toast';
import SearchableSelect from '../../../components/ui/SearchableSelect';
import { confirmDialog } from '../../../components/ui/ConfirmDialog';
import { API, bankLabel, getJson, pktToday, useBanks } from './bankReconUtils';
import './bankRecon.scss';
import './BankStatementPdfs.scss';

// Bank Statement PDFs (owner, 2026-11-24; migration 085). Each bank account's
// (JazzCash too) monthly statement PDF: upload it once, open it any time —
// any year, any month. Only kept and shown here; Upload Bank Statement and
// the matching screens are separate and don't use these files.
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const FIRST_YEAR = 2020;

const kb = (n) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const fmtWhen = (v) => {
  if (!v) return '';
  const d = new Date(v);
  const p = (x) => String(x).padStart(2, '0');
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

// Copy to the clipboard — the Clipboard API where the browser allows it, else
// the old select-and-copy (the hospital's plain-http address has no
// navigator.clipboard).
function copyByTextarea(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  const ok = document.execCommand('copy');
  ta.remove();
  if (!ok) throw new Error('Copy nahi hua');
}
async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    try { await navigator.clipboard.writeText(text); return; } catch { /* fall back below */ }
  }
  copyByTextarea(text);
}

export default function BankStatementPdfs() {
  const { entityType } = useParams();
  const navigate = useNavigate();
  const book = entityType === 'corporate' ? 'Panel (Corporate)' : 'Cash GL';
  const banks = useBanks(entityType);
  const today = pktToday();
  const thisYear = Number(today.slice(0, 4));
  const thisMonth = Number(today.slice(5, 7));

  const [bankId, setBankId] = useState(null);
  const [year, setYear] = useState(thisYear);
  const [rows, setRows] = useState(null);
  const [years, setYears] = useState([]);
  const [tick, setTick] = useState(0);
  const [uploading, setUploading] = useState(null); // month being uploaded
  const [viewer, setViewer] = useState(null); // { url, name, title, password }
  // Locked PDF: its password typed here, checked by the server against the PDF.
  const [pwEdit, setPwEdit] = useState(null); // { id, value, saving }
  const fileRef = useRef(null);
  const pendingMonth = useRef(null);

  const activeBankId = bankId ?? banks[0]?.id ?? null;
  const bank = banks.find((b) => b.id === activeBankId) || null;

  useEffect(() => {
    if (!activeBankId) return undefined;
    let live = true;
    getJson(`${API}/statement-pdfs?bankAccountId=${activeBankId}&year=${year}`)
      .then((d) => { if (live) { setRows(d.rows || []); setYears(d.years || []); } })
      .catch((e) => { if (live) { setRows([]); toast.error(e.message || 'PDFs did not load'); } });
    return () => { live = false; };
  }, [activeBankId, year, tick]);

  // Close the viewer: free the PDF held in memory.
  useEffect(() => () => { if (viewer?.url) URL.revokeObjectURL(viewer.url); }, [viewer]);
  useEffect(() => {
    if (!viewer) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setViewer(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [viewer]);

  const byMonth = new Map((rows || []).map((r) => [r.month, r]));
  const yearOptions = [...new Set([...years, ...Array.from({ length: thisYear - FIRST_YEAR + 1 }, (_, i) => thisYear - i)])].sort((a, b) => b - a);

  const pickFile = async (month) => {
    const existing = byMonth.get(month);
    if (existing) {
      const ok = await confirmDialog({
        title: `${MONTHS[month - 1]} ${year} ki PDF badlein?`,
        message: `"${existing.fileName}" pehle se hai. Nayi PDF chunein to purani ki jagah le legi.`,
        confirmLabel: 'Nayi PDF chunein',
      });
      if (!ok) return;
    }
    pendingMonth.current = month;
    fileRef.current?.click();
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    const month = pendingMonth.current;
    if (!file || !month || !activeBankId) return;
    if (file.type && file.type !== 'application/pdf') { toast.error('Sirf PDF file chunein'); return; }
    if (file.size > 25 * 1024 * 1024) { toast.error('PDF 25 MB se bari nahi ho sakti'); return; }
    const fd = new FormData();
    fd.append('year', String(year));
    fd.append('month', String(month));
    fd.append('file', file);
    setUploading(month);
    try {
      const res = await fetch(`${API}/statement-pdfs?bankAccountId=${activeBankId}`, { method: 'POST', body: fd });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j?.ok === false) throw new Error(j?.message || 'PDF upload nahi hui');
      toast.success(`${MONTHS[month - 1]} ${year} ki PDF save ho gayi`);
      setTick((t) => t + 1);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploading(null);
    }
  };

  const copyPassword = (password) => {
    copyText(password)
      .then(() => toast.success('Password copy ho gaya — PDF ke password khane me paste karein (Ctrl+V), phir Submit'))
      .catch(() => toast.error('Password copy nahi hua'));
  };

  const savePassword = async () => {
    if (!pwEdit) return;
    setPwEdit((p) => ({ ...p, saving: true }));
    try {
      const res = await fetch(`${API}/statement-pdfs/${pwEdit.id}/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pwEdit.value }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j?.ok === false) throw new Error(j?.message || 'Password save nahi hua');
      toast.success(j.message || 'Password save ho gaya');
      setPwEdit(null);
      setTick((t) => t + 1);
    } catch (err) {
      toast.error(err.message);
      setPwEdit((p) => (p ? { ...p, saving: false } : p));
    }
  };

  const view = async (row) => {
    try {
      const res = await fetch(`${API}/statement-pdfs/${row.id}/file`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.message || 'PDF nahi khuli');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      setViewer({ url, name: row.fileName, title: `${bank?.bankName || 'Bank'} — ${MONTHS[row.month - 1]} ${row.year}`, password: row.password || '' });
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="brc bsp">
      <div className="brc__bar">
        <button type="button" className="brc__back" onClick={() => navigate(`/accounts/${entityType}/transactions`)}><ArrowLeft size={14} /> Transactions</button>
        <div className="brc__heading">
          <h1>Bank Statement PDFs</h1>
          <span>{book} · each bank's monthly statement, to open any time</span>
        </div>
        <div className="brc__controls">
          <label className="brc__bank">
            <span>Bank Account</span>
            <SearchableSelect options={banks} value={activeBankId} onChange={(v) => { setBankId(v); setRows(null); }} placeholder="— Select bank —" getLabel={bankLabel} getKey={(b) => b.id} size="sm" />
          </label>
          <label>
            <span>Year</span>
            <select value={year} onChange={(e) => { setYear(Number(e.target.value)); setRows(null); }}>
              {yearOptions.map((y) => <option key={y} value={y}>{y}{years.includes(y) ? ' •' : ''}</option>)}
            </select>
          </label>
          <button type="button" className="brc__btn" onClick={() => setTick((t) => t + 1)} disabled={!activeBankId}><RefreshCw size={14} /> Refresh</button>
        </div>
      </div>

      <input ref={fileRef} type="file" accept="application/pdf,.pdf" hidden onChange={onFile} />

      {!banks.length && <p className="brc__empty">No bank account in this book yet.</p>}
      {activeBankId && rows === null && <p className="brc__empty">Loading…</p>}

      {activeBankId && rows !== null && (
        <>
          <p className="bsp__summary">
            <strong>{bank ? bankLabel(bank) : ''}</strong> · {year}: {rows.length} of 12 months uploaded
          </p>
          <div className="bsp__grid">
            {MONTHS.map((name, i) => {
              const month = i + 1;
              const row = byMonth.get(month);
              const future = year > thisYear || (year === thisYear && month > thisMonth);
              const busy = uploading === month;
              return (
                <section key={name} className={`bsp-card${row ? ' bsp-card--has' : ''}${future ? ' bsp-card--future' : ''}`}>
                  <header className="bsp-card__head">
                    <span className="bsp-card__month">{name}</span>
                    <span className="bsp-card__year">{year}</span>
                  </header>
                  {row ? (
                    <div className="bsp-card__file" title={row.fileName}>
                      <FileText size={16} aria-hidden="true" />
                      <div>
                        <div className="bsp-card__name">{row.fileName}</div>
                        <div className="bsp-card__meta">{kb(row.sizeBytes)} · {row.uploadedByName || '—'} · {fmtWhen(row.uploadedAt)}</div>
                        {row.isLocked && (
                          <div className={`bsp-card__lock${row.password ? ' is-saved' : ''}`}>
                            <Lock size={11} aria-hidden="true" /> Password protected · {row.password ? 'password saved' : 'password not saved'}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="bsp-card__none">{future ? 'Month not over yet' : 'No PDF yet'}</p>
                  )}
                  {row && pwEdit?.id === row.id && (
                    <form className="bsp-card__pw" onSubmit={(e) => { e.preventDefault(); savePassword(); }}>
                      <input
                        type="text"
                        autoFocus
                        autoComplete="off"
                        spellCheck={false}
                        value={pwEdit.value}
                        onChange={(e) => setPwEdit((p) => ({ ...p, value: e.target.value }))}
                        placeholder="PDF ka password"
                        aria-label={`${name} ${year} PDF password`}
                      />
                      <button type="submit" className="brc__btn brc__btn--primary brc__btn--sm" disabled={pwEdit.saving || !pwEdit.value}>{pwEdit.saving ? 'Checking…' : 'Save'}</button>
                      <button type="button" className="brc__btn brc__btn--sm" onClick={() => setPwEdit(null)}>Cancel</button>
                    </form>
                  )}
                  <div className="bsp-card__actions">
                    {row && (
                      <button type="button" className="brc__btn brc__btn--primary" onClick={() => view(row)}><Eye size={14} /> View</button>
                    )}
                    {row?.password && (
                      <button type="button" className="brc__btn" onClick={() => copyPassword(row.password)} title="PDF ka password copy karein"><Copy size={14} /> Copy password</button>
                    )}
                    {row?.isLocked && pwEdit?.id !== row.id && (
                      <button type="button" className="brc__btn brc__btn--sm" onClick={() => setPwEdit({ id: row.id, value: row.password || '', saving: false })}>
                        <KeyRound size={13} /> {row.password ? 'Change password' : 'Save password'}
                      </button>
                    )}
                    {!future && (
                      <button type="button" className="brc__btn" onClick={() => pickFile(month)} disabled={busy || uploading !== null}>
                        <Upload size={14} /> {busy ? 'Uploading…' : row ? 'Replace' : 'Upload PDF'}
                      </button>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </>
      )}

      {viewer && (
        <div className="bsp-viewer" role="dialog" aria-modal="true" aria-label={viewer.title}>
          <div className="bsp-viewer__bar">
            <strong>{viewer.title}</strong>
            <span className="bsp-viewer__name">{viewer.name}</span>
            {viewer.password && (
              <button type="button" className="brc__btn brc__btn--primary" onClick={() => copyPassword(viewer.password)}><Copy size={14} /> Copy password</button>
            )}
            <a className="brc__btn" href={viewer.url} target="_blank" rel="noreferrer"><ExternalLink size={14} /> New tab</a>
            <button type="button" className="brc__btn" onClick={() => setViewer(null)} aria-label="Close"><X size={14} /> Close</button>
          </div>
          <iframe className="bsp-viewer__frame" src={viewer.url} title={viewer.title} />
        </div>
      )}
    </div>
  );
}
