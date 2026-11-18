import { Fragment, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import ReportToolbar from '../../../components/reports/ReportToolbar';
import { API_BASE_URL } from '../../../config';
import { amt, fmt2, fmtDay, fmtIso, fmtTime, printPendingReport } from './pendingReportUtils';
import './DepartmentDoctorPerformanceReport.scss';
import './PendingReports.scss';

// Clinic → Reports → Credit Pending Report — the result (owner, 2026-11-18).
// One row per CC (credit card) OPD slip: its amount, any part taken at the
// counter (Receive Balance against Slip), what the bank credited, the bank's
// charges and what is still pending; optionally each bank receipt below it.
// A4 portrait, Arial 9pt.

const API = `${API_BASE_URL}/api/clinic`;
const SHOW_LABEL = { pending: 'Pending', settled: 'Received', all: 'All' };
// Column widths in mm (194 in all).
const COLS = [
  ['#', 7], ['Slip #', 16], ['Date', 17], ['Patient Name', 36], ['Department', 26],
  ['Amount', 18, true], ['At Counter', 17, true], ['Bank Recv.', 19, true], ['Charges', 17, true], ['Pending', 21, true],
];

export default function CreditPendingReport() {
  const [params] = useSearchParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const query = params.toString();
  const withReceipts = params.get('receipts') === '1';

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/reports/credit-pending?${query}`);
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j?.ok === false) throw new Error(j?.message || 'Report did not load');
      setData(j.data || null);
    } catch (e) {
      toast.error(e.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData(); }, [query]);

  const title = 'Credit Pending Report';
  const f = data?.filters;
  const criteria = f ? [
    f.from || f.to ? `Slip Date: ${fmtIso(f.from) || '…'} to ${fmtIso(f.to) || '…'}` : 'Slip Date: all dates',
    `Show: ${SHOW_LABEL[f.show] || f.show}`,
    f.q && `Search: ${f.q}`,
  ].filter(Boolean).join('  ·  ') : '';
  const rows = data?.rows || [];
  const t = data?.totals;
  const receiptText = (x) => `${fmtIso(String(x.receivedDate).slice(0, 10))}${x.bankName ? ` · ${x.bankName}` : ''} — ${fmt2(x.receivedAmount)}${Number(x.bankCharges) ? ` + charges ${fmt2(x.bankCharges)}` : ''}${x.remarks ? ` (${x.remarks})` : ''}`;

  const handleExportExcel = () => {
    if (!rows.length) { toast.error('No data to export'); return; }
    const aoa = [[title], [criteria], [],
      ['#', 'Slip #', 'Date', 'Patient Name', 'Department', 'Amount', 'At Counter', 'Bank Received', 'Bank Charges', 'Pending']];
    rows.forEach((r, i) => {
      aoa.push([i + 1, r.serialNo, `${fmtDay(r.createdAt)} ${fmtTime(r.createdAt)}`, r.patientName, r.department, r.amount, r.balancePaid, r.received, r.bankCharges, r.pending]);
      if (withReceipts) r.settlements.forEach((x) => aoa.push(['', '', '', `  Bank paid ${receiptText(x)}`, '', '', '', x.receivedAmount, x.bankCharges]));
    });
    aoa.push(['', `Total: ${t.slips} slip(s)`, '', '', '', t.amount, t.balancePaid, t.received, t.bankCharges, t.pending]);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 5 }, { wch: 11 }, { wch: 17 }, { wch: 28 }, { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 13 }, { wch: 12 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Credit Pending');
    XLSX.writeFile(wb, `credit_pending_${f?.show || ''}_${f?.from || 'all'}_${f?.to || ''}.xlsx`);
  };

  return (
    <div className="ddp-page">
      <ReportToolbar onPrint={() => printPendingReport(title, 'crr-printable')} onExport={handleExportExcel} onRefresh={fetchData} refreshing={loading} />

      <div className="ddp-report-area">
        <div className="ddp-report-page pdr-a4" id="crr-printable">
          <div className="ddp-print-header">
            <h1>{title}</h1>
            {criteria && <p className="pdr-criteria">{criteria}</p>}
          </div>

          {loading && <div className="ddp-empty">Loading data…</div>}
          {!loading && !rows.length && <div className="ddp-empty">No CC slip for the selected criteria.</div>}

          {!loading && rows.length > 0 && (
            <table className="ddp-table pdr-table">
              <colgroup>{COLS.map(([label, mm]) => <col key={label} style={{ width: `${mm}mm` }} />)}</colgroup>
              <thead>
                <tr>{COLS.map(([label, , num]) => <th key={label} className={num ? 'num' : undefined}>{label}</th>)}</tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const sub = withReceipts && r.settlements.length > 0;
                  return (
                    <Fragment key={r.visitId}>
                      <tr className={sub ? 'pdr-has-sub' : undefined}>
                        <td className="pdr-nowrap">{i + 1}</td>
                        <td className="pdr-nowrap">{r.serialNo}</td>
                        <td className="pdr-nowrap">{fmtDay(r.createdAt)}<br />{fmtTime(r.createdAt)}</td>
                        <td>{r.patientName}</td>
                        <td>{r.department}</td>
                        <td className="td-num pdr-nowrap">{amt(r.amount)}</td>
                        <td className="td-num pdr-nowrap">{amt(r.balancePaid)}</td>
                        <td className="td-num pdr-nowrap">{amt(r.received)}</td>
                        <td className="td-num pdr-nowrap">{amt(r.bankCharges)}</td>
                        <td className="td-num pdr-nowrap"><b>{fmt2(r.pending)}</b></td>
                      </tr>
                      {sub && (
                        <tr className="pdr-sub">
                          <td />
                          <td colSpan={9}>Bank paid: {r.settlements.map(receiptText).join(';  ')}</td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="pdr-total-row">
                  <td colSpan={5}>TOTAL ({t.slips} Slip{t.slips === 1 ? '' : 's'})</td>
                  <td className="td-num pdr-nowrap">{fmt2(t.amount)}</td>
                  <td className="td-num pdr-nowrap">{fmt2(t.balancePaid)}</td>
                  <td className="td-num pdr-nowrap">{fmt2(t.received)}</td>
                  <td className="td-num pdr-nowrap">{fmt2(t.bankCharges)}</td>
                  <td className="td-num pdr-nowrap">{fmt2(t.pending)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
