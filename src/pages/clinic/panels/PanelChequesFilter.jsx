import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload } from 'lucide-react';
import ClinicMenuBar from '../../../components/clinic/ClinicMenuBar';
import SearchableSelect from '../../../components/ui/SearchableSelect';
import { useClinicStore } from '../../../store/useClinicStore';
import PanelChequesImportModal from './PanelChequesImportModal';
import '../reports/ConsultantWiseFilter.scss';
import './PanelChequesReport.scss';

const todayIso = () => new Date().toISOString().slice(0, 10);

// Panels > Reports > Panel Cheques Report — filter step (owner's report
// format: filter screen first, then the preview). Same fields/defaults as
// the old "Bill Report" pop-up, which matched the legacy dialog exactly —
// now shown as the page itself. OK opens PanelChequesReport at /view.
export default function PanelChequesFilter() {
  const navigate = useNavigate();
  const { panelCompanies, fetchPanelCompanies } = useClinicStore();

  const [status, setStatus] = useState('both'); // due | received | both
  const [postDT, setPostDT] = useState(false);
  const [fromDate, setFromDate] = useState(todayIso());
  const [toDate, setToDate] = useState(todayIso());
  const [companyId, setCompanyId] = useState('ALL');
  const [summary, setSummary] = useState(true);
  const [groupBy, setGroupBy] = useState('comp'); // comp | month | patient
  const [showImport, setShowImport] = useState(false);

  useEffect(() => { fetchPanelCompanies(); }, [fetchPanelCompanies]);

  function handlePreview() {
    const q = new URLSearchParams({
      status, postDT: postDT ? '1' : '0', from: fromDate, to: toDate,
      companyId: companyId || 'ALL', summary: summary ? '1' : '0', groupBy,
    });
    navigate(`/clinic/panels/cheques-report/view?${q}`);
  }

  return (
    <div className="cwf-page pcqr-filter-page">
      <ClinicMenuBar />

      <div className="cwf-center">
        <div className="cwf-window">
          <div className="cwf-titlebar">
            <span className="cwf-title-left">Reports — Panel Cheques Report</span>
            <span className="cwf-title-right">Panel Cheques Report</span>
          </div>

          <div className="cwf-body">
            <div className="cwf-row">
              <label className="cwf-lbl">Status</label>
              <div className="cwf-radios">
                {[['due', 'Due'], ['received', 'Received'], ['both', 'Both']].map(([v, l]) => (
                  <label key={v} className="cwf-radio-label">
                    <input type="radio" name="pcqr-status" value={v} checked={status === v} onChange={() => setStatus(v)} />
                    {l}
                  </label>
                ))}
              </div>
            </div>

            <div className="cwf-row">
              <label className="cwf-lbl">Date</label>
              <label className="cwf-chk-label">
                <input type="checkbox" checked={postDT} onChange={(e) => setPostDT(e.target.checked)} />
                Post DT
              </label>
              <div className="cwf-field-group">
                <span className="cwf-sub-lbl">From</span>
                <input type="date" className="cwf-input" value={fromDate} onChange={(e) => setFromDate(e.target.value)} disabled={!postDT} />
              </div>
              <div className="cwf-field-group">
                <span className="cwf-sub-lbl">To</span>
                <input type="date" className="cwf-input" value={toDate} onChange={(e) => setToDate(e.target.value)} disabled={!postDT} />
              </div>
            </div>

            <div className="cwf-row">
              <label className="cwf-lbl">Company</label>
              <SearchableSelect
                options={[{ id: 'ALL' }, ...panelCompanies]}
                value={companyId}
                onChange={(v) => setCompanyId(v)}
                getKey={(c) => c.id}
                getLabel={(c) => (c.id === 'ALL' ? 'ALL' : `${c.code} — ${c.name}`)}
                clearable={false}
                size="sm"
                style={{ width: 300 }}
              />
            </div>

            <div className="cwf-radios">
              <label className="cwf-chk-label">
                <input type="checkbox" checked={summary} onChange={(e) => setSummary(e.target.checked)} />
                Summary
              </label>
              {[['comp', 'Comp'], ['month', 'Month'], ['patient', 'Patient']].map(([v, l]) => (
                <label key={v} className="cwf-radio-label">
                  <input type="radio" name="pcqr-groupby" value={v} checked={groupBy === v} onChange={() => setGroupBy(v)} disabled={!summary} />
                  {l}
                </label>
              ))}
            </div>

            <div className="cwf-actions">
              <button type="button" className="cwf-btn pcqr-btn-icon" onClick={() => setShowImport(true)}><Upload size={13} /> Upload Excel</button>
              <button type="button" className="cwf-btn cwf-btn--ok" onClick={handlePreview}>OK</button>
              <button type="button" className="cwf-btn" onClick={() => navigate(-1)}>Close</button>
            </div>
          </div>
        </div>
      </div>

      {showImport && (
        <PanelChequesImportModal
          onClose={() => setShowImport(false)}
          onImported={() => setShowImport(false)}
        />
      )}
    </div>
  );
}
