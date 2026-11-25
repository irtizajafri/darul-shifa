import { Fragment, useCallback, useEffect, useState } from 'react';
import { HandCoins, Printer, RefreshCw, Save, Search, X } from 'lucide-react';
import toast from 'react-hot-toast';
import JsBarcode from 'jsbarcode';
import ClinicMenuBar from '../../components/clinic/ClinicMenuBar';
import BackDateField, { getBackDate } from '../../components/clinic/BackDateField';
import AutoNumberField from '../../components/clinic/AutoNumberField';
import { confirmDialog } from '../../components/ui/ConfirmDialog';
import { useAuthStore } from '../../store/useAuthStore';
import { openPrintWindow } from '../../utils/printRelay';
import { API_BASE_URL } from '../../config';
import { buildAdmissionPaymentReceiptHtml } from './admissionReceivingReceiptUtils';
import { RECEIVING_MODES } from './receivingModes';
import './PendingTx.scss';

// Clinic → Transactions → Cash Pending Transaction (owner, 2026-11-17), like
// Panel Cheque Transaction for cash patients: files closed on Discharge and
// Refund with "Goes to Cash Pending". Figures are the Provisional Bill's, live
// (owner, 2026-11-18): Bill Amount, Discount, Received, Balance — Balance is
// what's owed. When the patient comes back, the money is received here — an
// ordinary admission receipt (same Slip #, back date and print as Receiving
// against Admission), counted on the day it's received.

const API = `${API_BASE_URL}/api/clinic`;
const fmt2 = (n) => Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDT = (d) => (d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');

export default function CashPendingTransaction() {
  const { user } = useAuthStore();
  const printedBy = user?.name || user?.username || user?.email || '';
  const [show, setShow] = useState('pending');
  const [q, setQ] = useState('');
  const [data, setData] = useState({ rows: [], totalRemaining: 0, openCount: 0 });
  const [loading, setLoading] = useState(false);
  const [openRow, setOpenRow] = useState(null);
  const [receiving, setReceiving] = useState(null); // row
  const [amount, setAmount] = useState('');
  const [serialNo, setSerialNo] = useState('');
  const [payMode, setPayMode] = useState('cash'); // mode of payment (owner, 2026-11-20)
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (s = show, term = q) => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ show: s });
      if (term.trim()) p.set('q', term.trim());
      const res = await fetch(`${API}/transactions/cash-pending?${p}`);
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j?.ok === false) throw new Error(j?.message || 'List did not load');
      setData(j.data);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [show, q]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  const openReceive = (r) => { setReceiving(r); setAmount(String(r.balance)); setSerialNo(''); setPayMode('cash'); };

  const submit = async (confirmNotDuplicate = false) => {
    const res = await fetch(`${API}/transactions/cash-pending/${receiving.admissionId}/receive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: Number(amount), serialNo, paymentType: payMode, receivedBy: printedBy, confirmNotDuplicate, backDate: getBackDate() }),
    });
    const j = await res.json().catch(() => ({}));
    if (res.status === 409 && j.code === 'POSSIBLE_DUPLICATE_RECEIPT') {
      const ok = await confirmDialog({ title: 'Is this receipt already there?', message: `${j.message}\n\nIf it is a new, separate receipt, press "Yes, new receipt".`, confirmLabel: 'Yes, new receipt' });
      if (!ok) return null;
      return submit(true);
    }
    if (!res.ok || j?.ok === false) throw new Error(j?.message || 'Receipt not saved');
    return j.data;
  };

  const save = async (andPrint) => {
    const amt = Number(amount);
    if (!(amt > 0)) { toast.error('Enter the amount received'); return; }
    if (amt > receiving.balance + 0.005) { toast.error(`Only Rs. ${fmt2(receiving.balance)} is pending on this file`); return; }
    const w = andPrint ? openPrintWindow('width=420,height=680') : null;
    setSaving(true);
    try {
      const d = await submit();
      if (!d) { w?.close(); return; }
      if (w) {
        const canvas = document.createElement('canvas');
        JsBarcode(canvas, d.payment.serialNo, { format: 'CODE128', width: 2, height: 48, displayValue: true, fontSize: 11, margin: 4 });
        w.document.write(buildAdmissionPaymentReceiptHtml({ payment: d.payment, admission: d.admission, printedBy, barcodeDataUrl: canvas.toDataURL('image/png'), isDuplicate: false }));
        w.document.close();
      }
      toast.success(`Rs. ${fmt2(amt)} received — Slip # ${d.payment.serialNo}`);
      setReceiving(null);
      load();
    } catch (e) {
      if (w && !w.filled) w.close();
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="ptx-page">
      <ClinicMenuBar />
      <div className="ptx-body">
        <div className="ptx-head">
          <div>
            <h1><HandCoins size={20} /> Cash Pending Transaction</h1>
            <p>Cash files closed with &quot;Goes to Cash Pending&quot; — figures from the Provisional Bill. Receive the balance when the patient pays.</p>
          </div>
          <div className="ptx-kpis">
            <div><span>Files pending</span><b>{data.openCount}</b></div>
            <div><span>Total pending</span><b>Rs. {fmt2(data.totalRemaining)}</b></div>
          </div>
        </div>

        <div className="ptx-toolbar">
          <div className="ptx-seg" role="radiogroup" aria-label="Show">
            {[['pending', 'Pending'], ['cleared', 'Cleared'], ['all', 'All']].map(([k, l]) => (
              <button type="button" key={k} className={show === k ? 'is-on' : ''} aria-pressed={show === k} onClick={() => { setShow(k); load(k, q); }}>{l}</button>
            ))}
          </div>
          <label className="ptx-search">
            <Search size={14} />
            <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} placeholder="Admission #, patient name or phone" aria-label="Search" />
          </label>
          <button type="button" className="ptx-btn" onClick={() => load()} disabled={loading}><RefreshCw size={14} /> Show</button>
        </div>

        <div className="ptx-card table-wrap">
          <table className="ptx-table">
            <thead>
              <tr><th>Admission #</th><th>Patient</th><th>Phone</th><th>Closed On</th><th>Allowed By</th><th className="r">Bill Amount</th><th className="r">Discount</th><th className="r">Received</th><th className="r">Balance</th><th /></tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={10} className="ptx-empty">Loading…</td></tr>}
              {!loading && !data.rows.length && <tr><td colSpan={10} className="ptx-empty">{show === 'pending' ? 'No cash pending file.' : 'Nothing to show.'}</td></tr>}
              {!loading && data.rows.map((r) => (
                <Fragment key={r.admissionId}>
                  <tr className="ptx-click" onClick={() => setOpenRow(openRow === r.admissionId ? null : r.admissionId)}>
                    <td><b>{r.admissionNo}</b></td>
                    <td>{r.patientName}</td>
                    <td className="muted">{r.phoneNo}</td>
                    <td className="nowrap">{fmtDT(r.closedAt)}</td>
                    <td className="muted">{r.approvedBy || ''}</td>
                    <td className="r">{fmt2(r.billAmount)}</td>
                    <td className="r">{r.discount ? fmt2(r.discount) : ''}</td>
                    <td className="r">{fmt2(r.received)}</td>
                    <td className="r"><b className={r.balance > 0 ? 'ptx-due' : 'ptx-clear'}>{fmt2(r.balance)}</b></td>
                    <td className="r">
                      {r.balance > 0 && (
                        <button type="button" className="ptx-btn ptx-btn--primary ptx-btn--sm" onClick={(e) => { e.stopPropagation(); openReceive(r); }}>Receive</button>
                      )}
                    </td>
                  </tr>
                  {openRow === r.admissionId && (
                    <tr className="ptx-sub"><td colSpan={10}>
                      <p className="muted">Balance at close: Rs. {fmt2(r.pendingAtClose)}{r.approvedBy ? ` · allowed by ${r.approvedBy}` : ''}. Figures above are the Provisional Bill&apos;s, live.</p>
                      {r.receipts.length ? (
                        <table className="ptx-table ptx-table--inner">
                          <thead><tr><th>Slip #</th><th>Received On</th><th className="r">Amount</th></tr></thead>
                          <tbody>{r.receipts.map((p) => <tr key={p.id}><td>{p.serialNo}</td><td>{fmtDT(p.receivedAt)}</td><td className="r">{fmt2(p.amount)}</td></tr>)}</tbody>
                        </table>
                      ) : <span className="muted">Nothing received yet against the pending balance.</span>}
                    </td></tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {receiving && (
        <div className="ptx-modal" role="dialog" aria-modal="true" aria-label="Receive cash pending">
          <div className="ptx-modal__box">
            <div className="ptx-modal__head">
              <h2>Receive — Admission # {receiving.admissionNo}</h2>
              <button type="button" className="ptx-icon" onClick={() => !saving && setReceiving(null)} aria-label="Close"><X size={18} /></button>
            </div>
            <div className="ptx-modal__body">
              <div className="ptx-facts">
                <span>Patient <b>{receiving.patientName}</b></span>
                <span>Bill Amount <b>{fmt2(receiving.billAmount)}</b></span>
                {receiving.discount > 0 && <span>Discount <b>{fmt2(receiving.discount)}</b></span>}
                <span>Received <b>{fmt2(receiving.received)}</b></span>
                <span>Balance <b className="ptx-due">{fmt2(receiving.balance)}</b></span>
              </div>
              <label className="ptx-field"><span>Amount Received</span>
                <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
              </label>
              <label className="ptx-field"><span>Mode of Payment</span>
                <select value={payMode} onChange={(e) => setPayMode(e.target.value)}>
                  {RECEIVING_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </label>
              <label className="ptx-field"><span>Slip #</span>
                <span style={{ display: 'flex', alignItems: 'center' }}>
                  <AutoNumberField kind="slip" value={serialNo} onChange={setSerialNo} style={{ flex: 1, minWidth: 0 }} />
                </span>
              </label>
              <BackDateField />
            </div>
            <div className="ptx-modal__foot">
              <button type="button" className="ptx-btn" onClick={() => setReceiving(null)} disabled={saving}>Cancel</button>
              <button type="button" className="ptx-btn" onClick={() => save(false)} disabled={saving}><Save size={14} /> Save</button>
              <button type="button" className="ptx-btn ptx-btn--primary" onClick={() => save(true)} disabled={saving}><Printer size={14} /> Save &amp; Print</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
