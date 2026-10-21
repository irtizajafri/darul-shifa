import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import ReportToolbar from '../../../components/reports/ReportToolbar';
import { useClinicStore } from '../../../store/useClinicStore';
import { printElementInPopup } from '../../../utils/printPopup';
import './PanelChequesReport.scss';
import './PanelChequePostingReport.scss';

const fmt = (n) => Number(n || 0).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// 'YYYY-MM-DD' → 'DD-MM-YYYY' (plain string, no timezone shift)
const fmtIso = (s) => (s ? `${s.slice(8, 10)}-${s.slice(5, 7)}-${s.slice(0, 4)}` : '');
// Entry timestamp → '13-10-2026' + '1:56:16PM', as the legacy report shows it
const fmtStamp = (d) => {
  if (!d) return ['', ''];
  const dt = new Date(d);
  const date = `${String(dt.getDate()).padStart(2, '0')}-${String(dt.getMonth() + 1).padStart(2, '0')}-${dt.getFullYear()}`;
  const h = dt.getHours();
  const time = `${h % 12 || 12}:${String(dt.getMinutes()).padStart(2, '0')}:${String(dt.getSeconds()).padStart(2, '0')}${h < 12 ? 'AM' : 'PM'}`;
  return [date, time];
};

// Panels > Reports > Panel Cheque Posting Report — legacy "Penal Cheque
// Posting Report": cheques posted from Panel Cheque Transaction, grouped by
// Cheque # (header line carries the cheque's amount), one line per
// admission / OPD slip it settled. Posting Date = the day the cheque was
// entered; Posted Date = the bill's own month (June file → 30-06).
// Preview step — PanelChequePostingFilter opens this at /view?from&to&basis.
export default function PanelChequePostingReport() {
  const { fetchPanelChequePostingReport } = useClinicStore();
  const [params] = useSearchParams();
  const reportRef = useRef(null);

  const fromDate = params.get('from') || '';
  const toDate = params.get('to') || '';
  const basis = params.get('basis') || 'posting';

  const [data, setData] = useState(null);
  const [applied, setApplied] = useState(null);
  // true until the first fetch lands, so the empty-state doesn't flash first
  const [loading, setLoading] = useState(true);

  const handlePreview = useCallback(async () => {
    if (!fromDate || !toDate) { toast.error('From aur To date dono chunein'); setLoading(false); return; }
    if (fromDate > toDate) { toast.error('From date, To date se pehle honi chahiye'); setLoading(false); return; }
    setLoading(true);
    try {
      const res = await fetchPanelChequePostingReport({ from: fromDate, to: toDate, basis });
      setData(res);
      setApplied({ from: fromDate, to: toDate });
    } catch (e) {
      toast.error(e.message || 'Report load nahi hui');
    } finally {
      setLoading(false);
    }
  }, [fetchPanelChequePostingReport, fromDate, toDate, basis]);

  useEffect(() => { handlePreview(); }, [handlePreview]);

  const cheques = data?.cheques || [];

  function handlePrint() {
    if (!cheques.length) { toast.error('Print ke liye koi data nahi'); return; }
    printElementInPopup(reportRef.current, { title: 'Panel Cheque Posting Report', page: 'A4 portrait', margin: '8mm' });
  }

  // Same lines as the preview: cheque header row (cheque # + amount), its
  // posting lines underneath, grand total last.
  function handleExport() {
    if (!cheques.length) { toast.error('Export ke liye koi data nahi'); return; }
    const aoa = [
      ['Panel Cheque Posting Report'],
      [`From : ${fmtIso(fromDate)}   To : ${fmtIso(toDate)}`],
      [],
      ['Type', 'Ref #', 'Patient Name', 'Posted Date', 'Cheque #', 'User', 'Posting Date', 'Posting Time', 'Cheque Amount'],
    ];
    cheques.forEach((c) => {
      aoa.push([c.chequeNo, '', '', '', '', '', '', '', Number(c.amount || 0)]);
      c.lines.forEach((l) => {
        const [d, t] = fmtStamp(l.postingAt);
        aoa.push([l.type, l.refNo, l.patientName, fmtIso(l.postedDate), l.chequeNo, l.user, d, t]);
      });
    });
    aoa.push(['', '', '', '', '', '', '', 'Grand Total', Number(data.grandTotal || 0)]);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cheque Posting');
    XLSX.writeFile(wb, `Panel_Cheque_Posting_${fromDate}_${toDate}.xlsx`);
  }

  return (
    <div className="pcqr-page">
      <ReportToolbar onPrint={handlePrint} onExport={handleExport} onRefresh={handlePreview} refreshing={loading} />

      <div className="pcqr-body">
        <div className="pcqr-report">
          <div className="pcpr-report rpt-arial9" ref={reportRef}>
            <div className="pcpr-head">
              <div className="pcpr-title">Panel Cheque Posting Report</div>
              {applied && <div className="pcpr-range">From : {fmtIso(applied.from)} &nbsp;To : {fmtIso(applied.to)}</div>}
            </div>

            {!data ? (
              <div className="pcpr-empty">{loading ? 'Loading…' : 'Report load nahi hui — Refresh dabayein.'}</div>
            ) : !cheques.length ? (
              <div className="pcpr-empty">Is date mein koi cheque post nahi hua.</div>
            ) : (
              <table className="pcpr-table">
                <tbody>
                  {cheques.map((c) => [
                    <tr className="pcpr-cheque-row" key={`h-${c.chequeNo}`}>
                      <td colSpan={6}>{c.chequeNo}</td>
                      <td className="r" colSpan={2}>{fmt(c.amount)}</td>
                    </tr>,
                    ...c.lines.map((l, i) => {
                      const [d, t] = fmtStamp(l.postingAt);
                      return (
                        <tr className="pcpr-line" key={`l-${c.chequeNo}-${i}`}>
                          <td>{l.type}</td>
                          <td>{l.refNo}</td>
                          <td className="pcpr-name">{l.patientName}</td>
                          <td>{fmtIso(l.postedDate)}</td>
                          <td>{l.chequeNo}</td>
                          <td>{l.user}</td>
                          <td>{d}</td>
                          <td>{t}</td>
                        </tr>
                      );
                    }),
                  ])}
                  <tr className="pcpr-grand">
                    <td colSpan={6} />
                    <td className="r" colSpan={2}>{fmt(data.grandTotal)}</td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
