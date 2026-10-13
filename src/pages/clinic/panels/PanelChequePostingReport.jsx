import { useState, useRef } from 'react';
import toast from 'react-hot-toast';
import { Printer, Filter as FilterIcon, X } from 'lucide-react';
import ClinicMenuBar from '../../../components/clinic/ClinicMenuBar';
import { useClinicStore } from '../../../store/useClinicStore';
import { printElementInPopup } from '../../../utils/printPopup';
import useModalKeys from '../../../hooks/useModalKeys';
import './PanelChequesReport.scss';
import './PanelChequePostingReport.scss';

const fmt = (n) => Number(n || 0).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
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
export default function PanelChequePostingReport() {
  const { fetchPanelChequePostingReport } = useClinicStore();
  const reportRef = useRef(null);

  const [showFilter, setShowFilter] = useState(true);
  const [fromDate, setFromDate] = useState(todayIso());
  const [toDate, setToDate] = useState(todayIso());
  const [basis, setBasis] = useState('posting');

  const [data, setData] = useState(null);
  const [applied, setApplied] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handlePreview() {
    if (!fromDate || !toDate) { toast.error('From aur To date dono chunein'); return; }
    if (fromDate > toDate) { toast.error('From date, To date se pehle honi chahiye'); return; }
    setLoading(true);
    try {
      const res = await fetchPanelChequePostingReport({ from: fromDate, to: toDate, basis });
      setData(res);
      setApplied({ from: fromDate, to: toDate });
      setShowFilter(false);
    } catch (e) {
      toast.error(e.message || 'Report load nahi hui');
    } finally {
      setLoading(false);
    }
  }

  const cheques = data?.cheques || [];

  return (
    <div className="pcqr-page">
      <ClinicMenuBar />

      <div className="pcqr-body">
        <div className="pcqr-toolbar no-print">
          <div className="pcqr-titlebar">Panel Cheque Posting Report</div>
          <div className="pcqr-toolbar-actions">
            <button className="pcqr-btn" onClick={() => setShowFilter(true)}><FilterIcon size={14} /> Filter</button>
            <button
              className="pcqr-btn pcqr-btn--print"
              onClick={() => printElementInPopup(reportRef.current, { title: 'Panel Cheque Posting Report', page: 'A4 portrait', margin: '8mm' })}
              disabled={!cheques.length}
            >
              <Printer size={14} /> Print
            </button>
          </div>
        </div>

        <div className="pcqr-report">
          <div className="pcpr-report" ref={reportRef}>
            <div className="pcpr-head">
              <div className="pcpr-title">Panel Cheque Posting Report</div>
              {applied && <div className="pcpr-range">From : {fmtIso(applied.from)} &nbsp;To : {fmtIso(applied.to)}</div>}
            </div>

            {!data ? (
              <div className="pcpr-empty">Filter set karke <b>Preview</b> dabayein.</div>
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

      {showFilter && (
        <FilterModal
          fromDate={fromDate} onFromDateChange={setFromDate}
          toDate={toDate} onToDateChange={setToDate}
          basis={basis} onBasisChange={setBasis}
          onClose={() => setShowFilter(false)}
          onPreview={handlePreview}
          loading={loading}
        />
      )}
    </div>
  );
}

// Matches the legacy "Report" dialog: From Dt / To Dt + Posting / Posted Date.
function FilterModal({ fromDate, onFromDateChange, toDate, onToDateChange, basis, onBasisChange, onClose, onPreview, loading }) {
  useModalKeys({ active: true, onEsc: onClose });
  return (
    <div className="pcqr-modal-overlay" onMouseDown={onClose}>
      <div className="pcqr-modal" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
        <div className="pcqr-modal-head">
          <span>Report</span>
          <button onClick={onClose} aria-label="Close" title="Close"><X size={16} /></button>
        </div>

        <div className="pcqr-modal-body">
          <div className="pcqr-filter-section pcpr-filter-grid">
            <label htmlFor="pcpr-from">From Dt :</label>
            <input id="pcpr-from" type="date" value={fromDate} onChange={(e) => onFromDateChange(e.target.value)} />
            <label className="pcqr-radio-lbl">
              <input type="radio" name="pcpr-basis" checked={basis === 'posting'} onChange={() => onBasisChange('posting')} />
              Posting Date
            </label>

            <label htmlFor="pcpr-to">To Dt :</label>
            <input id="pcpr-to" type="date" value={toDate} onChange={(e) => onToDateChange(e.target.value)} />
            <label className="pcqr-radio-lbl">
              <input type="radio" name="pcpr-basis" checked={basis === 'posted'} onChange={() => onBasisChange('posted')} />
              Posted Date
            </label>
          </div>
        </div>

        <div className="pcqr-modal-footer">
          <button className="pcqr-btn pcqr-btn--preview" onClick={onPreview} disabled={loading}>{loading ? 'Loading…' : 'Preview'}</button>
          <button className="pcqr-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
