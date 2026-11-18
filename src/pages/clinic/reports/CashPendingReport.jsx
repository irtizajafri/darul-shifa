import { Fragment, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import ReportToolbar from '../../../components/reports/ReportToolbar';
import { API_BASE_URL } from '../../../config';
import { amt, fmt2, fmtDay, fmtIso, fmtTime, printPendingReport } from './pendingReportUtils';
import './DepartmentDoctorPerformanceReport.scss';
import './PendingReports.scss';

// Clinic → Reports → Cash Pending Report — the result (owner, 2026-11-18).
// One row per file closed with "Goes to Cash Pending": the Provisional
// Bill's Bill Amount / Discount / Received / Balance (live), and optionally
// the receipts taken against the pending balance. A4 portrait, Arial 9pt.

const API = `${API_BASE_URL}/api/clinic`;
const SHOW_LABEL = { pending: 'Pending', cleared: 'Cleared', all: 'All' };
// Column widths in mm (194 in all).
const COLS = [
  ['#', 7], ['Admt. No', 17], ['Patient Name', 38], ['Phone #', 21], ['Closed On', 18], ['Allowed By', 21],
  ['Bill Amount', 18, true], ['Discount', 16, true], ['Received', 19, true], ['Balance', 19, true],
];

export default function CashPendingReport() {
  const [params] = useSearchParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const query = params.toString();
  const withReceipts = params.get('receipts') === '1';

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/reports/cash-pending?${query}`);
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

  const title = 'Cash Pending Report';
  const f = data?.filters;
  const criteria = f ? [
    f.from || f.to ? `Closed On: ${fmtIso(f.from) || '…'} to ${fmtIso(f.to) || '…'}` : 'Closed On: all dates',
    `Show: ${SHOW_LABEL[f.show] || f.show}`,
    f.q && `Search: ${f.q}`,
  ].filter(Boolean).join('  ·  ') : '';
  const rows = data?.rows || [];
  const t = data?.totals;

  const handleExportExcel = () => {
    if (!rows.length) { toast.error('No data to export'); return; }
    const aoa = [[title], [criteria], [],
      ['#', 'Admt. No', 'Patient Name', 'Phone #', 'Closed On', 'Allowed By', 'Bill Amount', 'Discount', 'Received', 'Balance', 'Balance at Close', 'Received against Pending']];
    rows.forEach((r, i) => {
      aoa.push([i + 1, r.admissionNo, r.patientName, r.phoneNo, r.closedAt ? `${fmtDay(r.closedAt)} ${fmtTime(r.closedAt)}` : '', r.approvedBy || '',
        r.billAmount, r.discount, r.received, r.balance, r.pendingAtClose, r.receivedAgainstPending]);
      if (withReceipts) r.receipts.forEach((p) => aoa.push(['', '', `  Receipt Slip # ${p.serialNo}`, '', `${fmtDay(p.receivedAt)} ${fmtTime(p.receivedAt)}`, '', '', '', p.amount]));
    });
    aoa.push(['', `Total: ${t.files} file(s)`, '', '', '', '', t.billAmount, t.discount, t.received, t.balance, t.pendingAtClose, t.receivedAgainstPending]);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 5 }, { wch: 12 }, { wch: 28 }, { wch: 14 }, { wch: 17 }, { wch: 16 }, { wch: 13 }, { wch: 11 }, { wch: 13 }, { wch: 13 }, { wch: 14 }, { wch: 14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cash Pending');
    XLSX.writeFile(wb, `cash_pending_${f?.show || ''}_${f?.from || 'all'}_${f?.to || ''}.xlsx`);
  };

  return (
    <div className="ddp-page">
      <ReportToolbar onPrint={() => printPendingReport(title, 'cpr-printable')} onExport={handleExportExcel} onRefresh={fetchData} refreshing={loading} />

      <div className="ddp-report-area">
        <div className="ddp-report-page pdr-a4" id="cpr-printable">
          <div className="ddp-print-header">
            <h1>{title}</h1>
            {criteria && <p className="pdr-criteria">{criteria}</p>}
          </div>

          {loading && <div className="ddp-empty">Loading data…</div>}
          {!loading && !rows.length && <div className="ddp-empty">No cash pending file for the selected criteria.</div>}

          {!loading && rows.length > 0 && (
            <>
              <table className="ddp-table pdr-table">
                <colgroup>{COLS.map(([label, mm]) => <col key={label} style={{ width: `${mm}mm` }} />)}</colgroup>
                <thead>
                  <tr>{COLS.map(([label, , num]) => <th key={label} className={num ? 'num' : undefined}>{label}</th>)}</tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const sub = withReceipts && r.receipts.length > 0;
                    return (
                      <Fragment key={r.admissionId}>
                        <tr className={sub ? 'pdr-has-sub' : undefined}>
                          <td className="pdr-nowrap">{i + 1}</td>
                          <td className="pdr-nowrap">{r.admissionNo}</td>
                          <td>{r.patientName}</td>
                          <td className="pdr-nowrap">{r.phoneNo}</td>
                          <td className="pdr-nowrap">{fmtDay(r.closedAt)}<br />{fmtTime(r.closedAt)}</td>
                          <td>{r.approvedBy || ''}</td>
                          <td className="td-num pdr-nowrap">{amt(r.billAmount)}</td>
                          <td className="td-num pdr-nowrap">{amt(r.discount)}</td>
                          <td className="td-num pdr-nowrap">{amt(r.received)}</td>
                          <td className="td-num pdr-nowrap"><b>{fmt2(r.balance)}</b></td>
                        </tr>
                        {sub && (
                          <tr className="pdr-sub">
                            <td />
                            <td colSpan={9}>
                              Balance at close {fmt2(r.pendingAtClose)} · received later: {r.receipts.map((p) => `Slip # ${p.serialNo} on ${fmtDay(p.receivedAt)} — ${fmt2(p.amount)}`).join(';  ')}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="pdr-total-row">
                    <td colSpan={6}>TOTAL ({t.files} File{t.files === 1 ? '' : 's'})</td>
                    <td className="td-num pdr-nowrap">{fmt2(t.billAmount)}</td>
                    <td className="td-num pdr-nowrap">{fmt2(t.discount)}</td>
                    <td className="td-num pdr-nowrap">{fmt2(t.received)}</td>
                    <td className="td-num pdr-nowrap">{fmt2(t.balance)}</td>
                  </tr>
                </tfoot>
              </table>
              <p className="pdr-summary">
                Balance at close: <b>{fmt2(t.pendingAtClose)}</b>  ·  Received against pending: <b>{fmt2(t.receivedAgainstPending)}</b>  ·  Still pending: <b>{fmt2(t.balance)}</b>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
