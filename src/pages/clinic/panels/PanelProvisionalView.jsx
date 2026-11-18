import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { API_BASE_URL } from '../../../config';
import '../ProvisionalBill.scss';

// Panels → Billing → "Provisional Bill" tab (owner, 2026-11-18): the file's
// Provisional Bill exactly as entered on the Provisional Bill screen —
// Provisional / Diagnostic / Pharmacy, Ward History and the totals — to look
// at only. Nothing can be added, edited or removed here.

const API = `${API_BASE_URL}/api/clinic`;
const TABS = ['Provisional Bill', 'Diagnostic Bill', 'Pharmacy Bill'];
const fmt2 = (n) => Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Karachi' }) : '—');
const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Karachi' }) : '—');
const sumOf = (rows) => rows.reduce((s, r) => s + Number(r.amount || 0), 0);

export default function PanelProvisionalView({ admissionId }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState(TABS[0]);

  const load = useCallback(async () => {
    if (!admissionId) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/provisional-bill/${admissionId}`);
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j?.ok === false) throw new Error(j?.message || 'Provisional Bill did not load');
      setDetail(j.data);
    } catch (e) {
      setError(e.message);
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [admissionId]);

  useEffect(() => { load(); }, [load]);

  if (loading && !detail) return <div className="pnb-pv-msg">Loading Provisional Bill…</div>;
  if (error) return <div className="pnb-pv-msg pnb-pv-msg--err">{error}</div>;
  if (!detail) return null;

  const b = detail.balanceInfo || {};
  const hospitalRows = detail.pharmacyRows.filter((r) => r.source === 'hospital');
  const outsideRows = detail.pharmacyRows.filter((r) => r.source === 'outside');

  return (
    <div className="pnb-pv">
      <div className="pnb-pv-head">
        <span className="pnb-pv-badge">View only</span>
        <span>
          Ward <b>{detail.roomCategory?.name || '—'}</b>
          {detail.bed?.name ? <> · Bed <b>{detail.bed.name}</b></> : null}
          {detail.consultant?.name ? <> · Consultant <b>{detail.consultant.name}</b></> : null}
        </span>
        <button type="button" className="pnb-pv-refresh" onClick={load} disabled={loading} title="Reload from the Provisional Bill">
          <RefreshCw size={13} /> {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      <div className="pnb-pv-totals">
        <div><label>Bill Amount</label><span>{fmt2(b.billAmount)}</span></div>
        <div><label>Discount{b.discountPermissionBy ? ` (by ${b.discountPermissionBy})` : ''}</label><span>{Number(b.discount) ? `-${fmt2(b.discount)}` : fmt2(0)}</span></div>
        <div><label>Net Bill</label><span>{fmt2(b.netBillAmount)}</span></div>
        <div><label>Received</label><span>{fmt2(b.amountReceived)}</span></div>
        <div className="pnb-pv-em"><label>Balance</label><span>{fmt2(b.balance)}</span></div>
        {Number(b.refund) > 0 && <div><label>Refund</label><span>{fmt2(b.refund)}</span></div>}
      </div>

      <div className="pb-tabs">
        {TABS.map((t) => (
          <button key={t} type="button" className={`pb-tab ${tab === t ? 'pb-tab--active' : ''}`} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {tab === 'Provisional Bill' && (
        <>
          {detail.wardHistory?.length > 0 && (
            <>
              <div className="pb-subsection-title">Ward History</div>
              <table className="pb-table pb-table--readonly">
                <thead><tr><th>Ward</th><th>Bed</th><th>Entered</th><th>Transferred</th></tr></thead>
                <tbody>
                  {detail.wardHistory.map((seg, i) => (
                    <tr key={i}>
                      <td>{seg.roomCategory?.name || '—'}</td>
                      <td>{seg.bed?.name || '—'}</td>
                      <td>{fmtDateTime(seg.enteredAt)}</td>
                      <td>{seg.transferredAt ? fmtDateTime(seg.transferredAt) : <em>Current</em>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          <div className="pb-subsection-title">Bill Heads</div>
          <table className="pb-table pb-table--readonly">
            <thead>
              <tr><th>Date</th><th>Ward Name</th><th>Heads</th><th className="r">Qty.</th><th className="r">Rate</th><th className="r">Amount</th><th>Remarks</th><th>PatType</th></tr>
            </thead>
            <tbody>
              {detail.billItems.map((i) => (
                <tr key={i.id}>
                  <td>{fmtDate(i.createdAt)}</td>
                  <td>{i.roomCategory?.name || '—'}</td>
                  <td>{i.billHead?.description || i.billHead?.headCode || '—'}</td>
                  <td className="r">{i.qty}</td>
                  <td className="r">{fmt2(i.rate)}</td>
                  <td className="r">{fmt2(i.amount)}</td>
                  <td>{i.remarks || ''}</td>
                  <td>{i.patientType || ''}</td>
                </tr>
              ))}
              {!detail.billItems.length && !detail.pharmacyAmount && !detail.diagnosticAmount && (
                <tr><td colSpan={8} className="pb-empty">Provisional Bill pe koi row nahi</td></tr>
              )}
              {detail.diagnosticAmount > 0 && (
                <tr className={detail.diagnosticBillExcluded ? 'pb-row--auto-excluded' : 'pb-row--auto'}>
                  <td>—</td><td>—</td>
                  <td>Diagnostic{detail.diagnosticBillExcluded ? ' — excluded from bill' : ''}</td>
                  <td className="r">1</td>
                  <td className="r">{fmt2(detail.diagnosticAmount)}</td>
                  <td className="r">{detail.diagnosticBillExcluded ? '—' : fmt2(detail.diagnosticAmount)}</td>
                  <td /><td />
                </tr>
              )}
              {detail.pharmacyAmount > 0 && (
                <tr className={detail.pharmacyBillExcluded ? 'pb-row--auto-excluded' : 'pb-row--auto'}>
                  <td>—</td><td>—</td>
                  <td>Medicine (Pharmacy){detail.pharmacyBillExcluded ? ' — excluded from bill' : ''}</td>
                  <td className="r">1</td>
                  <td className="r">{fmt2(detail.pharmacyAmount)}</td>
                  <td className="r">{detail.pharmacyBillExcluded ? '—' : fmt2(detail.pharmacyAmount)}</td>
                  <td /><td />
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr><td colSpan={5} className="pb-tf-label">Bill Amount</td><td className="r">{fmt2(b.billAmount)}</td><td colSpan={2} /></tr>
            </tfoot>
          </table>
        </>
      )}

      {tab === 'Diagnostic Bill' && (
        <table className="pb-table pb-table--readonly">
          <thead><tr><th>Date</th><th>ConCode</th><th>Lab/USound/XRay</th><th>Particulars</th><th className="r">Amount</th></tr></thead>
          <tbody>
            {detail.diagnosticRows.map((r) => (
              <tr key={r.id}>
                <td>{fmtDate(r.date)}</td>
                <td>{r.conCode || '—'}</td>
                <td>{r.department}</td>
                <td>{r.particulars || '—'}</td>
                <td className="r">{fmt2(r.amount)}</td>
              </tr>
            ))}
            {!detail.diagnosticRows.length && <tr><td colSpan={5} className="pb-empty">Koi diagnostic test is admission se link nahi</td></tr>}
          </tbody>
          <tfoot>
            <tr><td colSpan={4} className="pb-tf-label">Diagnostic Total{detail.diagnosticBillExcluded ? ' (excluded from bill)' : ''}</td><td className="r">{fmt2(sumOf(detail.diagnosticRows))}</td></tr>
          </tfoot>
        </table>
      )}

      {tab === 'Pharmacy Bill' && (
        <>
          <div className="pb-pharmacy-auto-title">Hospital / In-House Store</div>
          <table className="pb-table pb-table--readonly">
            <thead><tr><th>Date</th><th>Medicine</th><th className="r">Qty</th><th className="r">Rate</th><th className="r">Amount</th></tr></thead>
            <tbody>
              {hospitalRows.map((r) => (
                <tr key={r.id}><td>{fmtDate(r.date)}</td><td>{r.medicine}</td><td className="r">{r.qty}</td><td className="r">{fmt2(r.rate)}</td><td className="r">{fmt2(r.amount)}</td></tr>
              ))}
              {!hospitalRows.length && <tr><td colSpan={5} className="pb-empty">Is admission # ke against koi Sales Invoice nahi</td></tr>}
            </tbody>
            <tfoot><tr><td colSpan={4} className="pb-tf-label">Hospital Store Total</td><td className="r">{fmt2(sumOf(hospitalRows))}</td></tr></tfoot>
          </table>

          <div className="pb-pharmacy-manual-title">Outside Hospital Store</div>
          <table className="pb-table pb-table--readonly">
            <thead><tr><th>Date</th><th>Store</th><th>Medicine</th><th>Dosage</th><th className="r">Quantity</th><th className="r">Rate</th><th className="r">Amount</th><th>Remarks</th></tr></thead>
            <tbody>
              {outsideRows.map((r) => (
                <tr key={r.id}>
                  <td>{fmtDate(r.date)}</td><td>{r.storeName || '—'}</td><td>{r.medicine}</td><td>{r.dosage || ''}</td>
                  <td className="r">{r.qty}{r.unit ? ` ${r.unit}` : ''}</td><td className="r">{fmt2(r.rate)}</td><td className="r">{fmt2(r.amount)}</td><td>{r.remarks || ''}</td>
                </tr>
              ))}
              {!outsideRows.length && <tr><td colSpan={8} className="pb-empty">Outside store ki koi medicine nahi</td></tr>}
            </tbody>
            <tfoot><tr><td colSpan={6} className="pb-tf-label">Outside Store Total{detail.pharmacyBillExcluded ? ' (pharmacy excluded from bill)' : ''}</td><td className="r">{fmt2(sumOf(outsideRows))}</td><td /></tr></tfoot>
          </table>
        </>
      )}
    </div>
  );
}
