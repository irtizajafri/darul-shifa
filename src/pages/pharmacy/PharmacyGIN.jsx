import { Fragment, useCallback, useEffect, useState } from 'react';
import { PackageCheck, Printer, Save, X } from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader from '../../components/shared/PageHeader';
import SearchableSelect from '../../components/ui/SearchableSelect';
import { useAuthStore } from '../../store/useAuthStore';
import { canBackDate } from '../../utils/permissions';
import { openPrintWindow } from '../../utils/printRelay';
import {
  pharmacyApi, getJson, EMPLOYEES_API, pktToday, daysBefore, fmtDate, fmtQty, fmtAmt, employeeName, patientRef,
} from './pharmacyApi';
import { printGIN } from './pharmacyPrint';
import './Pharmacy.scss';

// Al Shifa Hospital Pharmacy → Goods Issuance (GIN), like Inventory's GIN:
// pick a GD that isn't fully issued, Issue Date and Issued To, then the
// quantity of each medicine (up to what's still left on the GD). No stock
// check — the pharmacy keeps none. Rate starts at the Medicine List retail
// price and can be changed per line at issue (owner, 2026-11-17).

export default function PharmacyGIN() {
  const { user } = useAuthStore();
  const userName = user?.name || user?.username || user?.email || '';
  const backDate = canBackDate(user);
  const [openGDs, setOpenGDs] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [gdId, setGdId] = useState('');
  const [gd, setGd] = useState(null);
  const [qty, setQty] = useState({});
  const [rate, setRate] = useState({});
  const [issueDate, setIssueDate] = useState(pktToday());
  const [issuedToId, setIssuedToId] = useState('');
  const [saving, setSaving] = useState(false);
  const [filters, setFilters] = useState({ from: daysBefore(pktToday(), 7), to: pktToday(), q: '' });
  const [list, setList] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const [openRow, setOpenRow] = useState(null);

  const loadOpen = useCallback(() => pharmacyApi('/gd?status=pending').then(setOpenGDs).catch((e) => toast.error(e.message)), []);
  const loadList = useCallback(async (f) => {
    setListLoading(true);
    try {
      const p = new URLSearchParams();
      if (f.q.trim()) p.set('q', f.q.trim()); else { if (f.from) p.set('from', f.from); if (f.to) p.set('to', f.to); }
      setList(await pharmacyApi(`/gin?${p}`));
    } catch (e) {
      toast.error(e.message);
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOpen();
    getJson(EMPLOYEES_API).then((d) => setEmployees((d || []).filter((e) => String(e.status || 'active').toLowerCase() !== 'inactive'))).catch((e) => toast.error(e.message));
    loadList(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pickGD = async (id) => {
    setGdId(id || '');
    setGd(null);
    setQty({});
    setRate({});
    if (!id) return;
    try {
      const g = await pharmacyApi(`/gd/${id}`);
      setGd(g);
      // Each line starts at what's still left to issue.
      setQty(Object.fromEntries(g.items.map((it) => [it.id, String(Math.max(0, it.quantityRequested - it.quantityIssued))])));
      setRate(Object.fromEntries(g.items.map((it) => [it.id, String(it.currentRate ?? 0)])));
    } catch (e) {
      toast.error(e.message);
    }
  };

  const left = (it) => Math.max(0, it.quantityRequested - it.quantityIssued);
  const rateOf = (it) => (rate[it.id] === undefined ? Number(it.currentRate || 0) : Number(rate[it.id]) || 0);
  const total = gd ? gd.items.reduce((s, it) => s + (Number(qty[it.id]) || 0) * rateOf(it), 0) : 0;

  const reset = () => { setGdId(''); setGd(null); setQty({}); setRate({}); setIssuedToId(''); setIssueDate(pktToday()); };

  const save = async (andPrint) => {
    if (!gd) { toast.error('Select the GD'); return; }
    if (!issuedToId) { toast.error('Select Issued To'); return; }
    const items = gd.items.map((it) => ({ gdItemId: it.id, quantity: Number(qty[it.id]) || 0, rate: rate[it.id] ?? it.currentRate })).filter((l) => l.quantity > 0);
    if (!items.length) { toast.error('Enter the quantity to issue'); return; }
    const badRate = items.find((l) => l.rate === '' || !(Number(l.rate) >= 0));
    if (badRate) { toast.error(`${gd.items.find((it) => it.id === badRate.gdItemId)?.medicineName}: enter a valid rate`); return; }
    const over = gd.items.find((it) => (Number(qty[it.id]) || 0) > left(it) + 1e-9);
    if (over) { toast.error(`${over.medicineName}: only ${fmtQty(left(over))} left on this GD`); return; }
    const win = andPrint ? openPrintWindow() : null;
    setSaving(true);
    try {
      const gin = await pharmacyApi('/gin', { method: 'POST', body: { gdId: gd.id, issueDate, issuedToId, items, createdByName: userName } });
      toast.success(`GIN ${gin.code} saved`);
      if (win) printGIN(gin, userName, win);
      reset();
      loadOpen();
      loadList(filters);
    } catch (e) {
      win?.close();
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); if (!saving) save(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="ph-page">
      <PageHeader
        breadcrumbs={[{ label: 'Al Shifa Hospital Pharmacy', link: '/pharmacy-module' }, { label: 'Goods Issuance (GIN)' }]}
        title="Goods Issuance (GIN)"
        subtitle="Issue the medicines of a GD — to its department or patient"
      />

      <section className="ph-card">
        <h2 className="ph-card__title"><PackageCheck size={16} /> Create Goods Issuance (GIN)</h2>
        <div className="ph-grid ph-grid--3">
          <label className="ph-field">
            <span>Goods Demand (GD) *</span>
            <SearchableSelect
              options={openGDs}
              value={gdId}
              onChange={pickGD}
              getKey={(g) => g.id}
              getLabel={(g) => [g.code, g.departmentName, patientRef(g), g.patientName].filter(Boolean).join(' · ')}
              placeholder={openGDs.length ? `Select a GD — ${openGDs.length} not fully issued` : 'No GD waiting to be issued'}
              size="sm"
            />
          </label>
          <label className="ph-field">
            <span>Issue Date</span>
            <input type="date" className="ph-input" value={issueDate} max={pktToday()} disabled={!backDate} onChange={(e) => setIssueDate(e.target.value)} />
          </label>
          <label className="ph-field">
            <span>Issued To *</span>
            <SearchableSelect options={employees} value={issuedToId} onChange={(v) => setIssuedToId(v || '')} getKey={(e) => e.id} getLabel={(e) => `${employeeName(e)}${e.empCode ? ` (${e.empCode})` : ''}`} placeholder="Select staff" size="sm" />
          </label>
        </div>

        {gd && (
          <div className="ph-gdinfo">
            <span><b>Department:</b> {gd.departmentName}</span>
            <span><b>Request Date:</b> {fmtDate(gd.requestDate)}</span>
            {patientRef(gd) && <span><b>{gd.admissionNumber ? 'Admission #' : 'Panel Slip #'}:</b> {gd.admissionNumber || gd.opdSlipNo}</span>}
            {gd.patientName && <span><b>Patient:</b> {gd.patientName}</span>}
            {gd.comment && <span><b>Comment:</b> {gd.comment}</span>}
          </div>
        )}

        <div className="table-wrap ph-lines">
          <table className="ph-table">
            <thead>
              <tr><th style={{ width: 40 }}>#</th><th>Medicine</th><th style={{ width: 80 }}>Pack</th><th className="r" style={{ width: 95 }}>Demanded</th><th className="r" style={{ width: 95 }}>Issued</th><th className="r" style={{ width: 95 }}>Left</th><th style={{ width: 120 }}>Issue Qty</th><th style={{ width: 120 }}>Rate</th><th className="r" style={{ width: 110 }}>Amount</th></tr>
            </thead>
            <tbody>
              {!gd && <tr><td colSpan={9} className="ph-empty">Select a GD to issue its medicines.</td></tr>}
              {gd && gd.items.map((it, i) => {
                const q = Number(qty[it.id]) || 0;
                const done = left(it) <= 1e-9;
                return (
                  <tr key={it.id} className={done ? 'ph-row--done' : ''}>
                    <td>{i + 1}</td>
                    <td>{it.medicineName}<span className="muted"> {it.medicineCode}</span></td>
                    <td className="muted">{it.packSize || ''}</td>
                    <td className="r">{fmtQty(it.quantityRequested)}</td>
                    <td className="r">{fmtQty(it.quantityIssued)}</td>
                    <td className="r">{fmtQty(left(it))}</td>
                    <td>
                      <input className="ph-input ph-input--qty" inputMode="decimal" value={qty[it.id] ?? ''} disabled={done}
                        onChange={(e) => setQty((x) => ({ ...x, [it.id]: e.target.value }))} aria-label={`${it.medicineName} issue quantity`} />
                    </td>
                    <td>
                      <input className="ph-input ph-input--qty" inputMode="decimal" value={rate[it.id] ?? ''} disabled={done}
                        onChange={(e) => setRate((x) => ({ ...x, [it.id]: e.target.value }))} aria-label={`${it.medicineName} rate`}
                        title={`Medicine List price: ${fmtAmt(it.currentRate)}`} />
                    </td>
                    <td className="r">{fmtAmt(q * rateOf(it))}</td>
                  </tr>
                );
              })}
            </tbody>
            {gd && (
              <tfoot><tr><td colSpan={8} className="r"><b>Total</b></td><td className="r"><b>{fmtAmt(total)}</b></td></tr></tfoot>
            )}
          </table>
        </div>

        <div className="ph-actions">
          <button type="button" className="ph-btn" onClick={reset} disabled={saving}><X size={14} /> Clear</button>
          <button type="button" className="ph-btn" onClick={() => save(false)} disabled={saving || !gd}><Save size={14} /> Save GIN</button>
          <button type="button" className="ph-btn ph-btn--primary" onClick={() => save(true)} disabled={saving || !gd}><Printer size={14} /> Save &amp; Print</button>
        </div>
      </section>

      <section className="ph-card">
        <div className="ph-toolbar">
          <h2 className="ph-card__title">Goods Issuance Notes</h2>
          <label className="ph-field ph-field--inline"><span>From</span><input type="date" className="ph-input" value={filters.from} disabled={!!filters.q.trim()} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} /></label>
          <label className="ph-field ph-field--inline"><span>To</span><input type="date" className="ph-input" value={filters.to} disabled={!!filters.q.trim()} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} /></label>
          <label className="ph-field ph-field--inline ph-grow"><span>Search (all dates)</span><input className="ph-input" value={filters.q} onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))} onKeyDown={(e) => e.key === 'Enter' && loadList(filters)} placeholder="GIN #, Adm #, Slip # or patient" /></label>
          <button type="button" className="ph-btn ph-btn--primary" onClick={() => loadList(filters)} disabled={listLoading}>Show</button>
        </div>
        <div className="table-wrap">
          <table className="ph-table ph-table--click">
            <thead><tr><th>GIN #</th><th>Date</th><th>GD #</th><th>Department</th><th>Patient</th><th>Issued To</th><th className="r">Amount</th><th /></tr></thead>
            <tbody>
              {listLoading && <tr><td colSpan={8} className="ph-empty">Loading…</td></tr>}
              {!listLoading && !list.length && <tr><td colSpan={8} className="ph-empty">No GIN on these dates.</td></tr>}
              {!listLoading && list.map((g) => (
                <Fragment key={g.id}>
                  <tr onClick={() => setOpenRow(openRow === g.id ? null : g.id)}>
                    <td className="nowrap"><b>{g.code}</b></td>
                    <td className="nowrap">{fmtDate(g.issueDate)}</td>
                    <td className="nowrap muted">{g.gd?.code}</td>
                    <td>{g.departmentName}</td>
                    <td>{patientRef(g)}{g.patientName ? <span className="muted"> · {g.patientName}</span> : ''}</td>
                    <td>{g.issuedToName || ''}</td>
                    <td className="r">{fmtAmt(g.totalAmount)}</td>
                    <td className="r"><button type="button" className="ph-icon-btn" title="Print GIN" aria-label={`Print ${g.code}`} onClick={(e) => { e.stopPropagation(); printGIN(g, userName); }}><Printer size={14} /></button></td>
                  </tr>
                  {openRow === g.id && (
                    <tr className="ph-sub"><td colSpan={8}>
                      <table className="ph-table ph-table--inner">
                        <thead><tr><th>Medicine</th><th>Pack</th><th className="r">Qty</th><th className="r">Rate</th><th className="r">Amount</th></tr></thead>
                        <tbody>{g.items.map((it) => (
                          <tr key={it.id}><td>{it.medicineName}</td><td className="muted">{it.packSize || ''}</td><td className="r">{fmtQty(it.quantity)}</td><td className="r">{fmtAmt(it.rate)}</td><td className="r">{fmtAmt(it.amount)}</td></tr>
                        ))}</tbody>
                      </table>
                    </td></tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
