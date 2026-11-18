import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import ClinicMenuBar from '../../../components/clinic/ClinicMenuBar';
import './ConsultantWiseFilter.scss';
import './PendingReports.scss';

// Clinic → Reports → Credit Pending Report (owner, 2026-11-18): CC (credit
// card) OPD slips and what the bank has paid for them — same figures as
// Transactions → Credit Pending Transaction. OK opens the report (A4
// portrait, Arial 9pt).

const PKT_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit' });
const pktToday = () => PKT_DAY.format(new Date());
const SHOW = [['pending', 'Pending'], ['settled', 'Received'], ['all', 'All']];

const blank = () => ({ allDates: true, from: `${pktToday().slice(0, 8)}01`, to: pktToday(), show: 'pending', q: '', receipts: true });

export default function CreditPendingReportFilter() {
  const navigate = useNavigate();
  const [f, setF] = useState(blank);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));

  const preview = () => {
    if (!f.allDates) {
      if (!f.from || !f.to) { toast.error('Select the slip dates'); return; }
      if (f.from > f.to) { toast.error('From date is after To date'); return; }
    }
    const p = new URLSearchParams({ show: f.show });
    if (!f.allDates) { p.set('from', f.from); p.set('to', f.to); }
    if (f.q.trim()) p.set('q', f.q.trim());
    if (f.receipts) p.set('receipts', '1');
    navigate(`/clinic/reports/credit-pending/view?${p}`);
  };
  const onKey = (e) => { if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'checkbox') { e.preventDefault(); preview(); } };

  return (
    <div className="cwf-page">
      <ClinicMenuBar />
      <div className="cwf-center">
        <div className="cwf-window pdf-window" onKeyDown={onKey}>
          <div className="cwf-titlebar">
            <span className="cwf-title-left">Reports — Credit Pending</span>
            <span className="cwf-title-right">Credit Pending Report</span>
          </div>
          <div className="cwf-body">
            <fieldset className="cwf-fieldset pdf-criteria">
              <legend className="cwf-legend">Selection Criteria</legend>

              <div className="cwf-row pdf-dates">
                <label className="cwf-lbl">Slip Date</label>
                <input type="date" className="cwf-input" aria-label="Slip date from" value={f.from} disabled={f.allDates} onChange={(e) => set('from', e.target.value)} />
                <span className="pdf-to">to</span>
                <input type="date" className="cwf-input" aria-label="Slip date to" value={f.to} min={f.from} disabled={f.allDates} onChange={(e) => set('to', e.target.value)} />
                <label className="pdf-check"><input type="checkbox" checked={f.allDates} onChange={(e) => set('allDates', e.target.checked)} /> All dates</label>
              </div>

              <div className="cwf-row">
                <label className="cwf-lbl">Show</label>
                <div className="cwf-radios pdf-radios">
                  {SHOW.map(([v, l]) => (
                    <label key={v} className="cwf-radio-label">
                      <input type="radio" name="crr-show" checked={f.show === v} onChange={() => set('show', v)} /> {l}
                    </label>
                  ))}
                </div>
              </div>

              <div className="cwf-row">
                <label className="cwf-lbl" htmlFor="crr-q">Search</label>
                <input id="crr-q" className="cwf-input pdf-wide" value={f.q} onChange={(e) => set('q', e.target.value)} placeholder="Slip # or patient name (blank = all)" autoFocus />
              </div>

              <div className="cwf-row">
                <label className="cwf-lbl" />
                <label className="pdf-check"><input type="checkbox" checked={f.receipts} onChange={(e) => set('receipts', e.target.checked)} /> Show the bank receipts under each slip</label>
              </div>
            </fieldset>

            <div className="cwf-actions">
              <button type="button" className="cwf-btn cwf-btn--ok" onClick={preview}>OK</button>
              <button type="button" className="cwf-btn" onClick={() => setF(blank())}>Clear</button>
              <button type="button" className="cwf-btn" onClick={() => navigate(-1)}>Close</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
