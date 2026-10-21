import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload } from 'lucide-react';
import ClinicMenuBar from '../../../components/clinic/ClinicMenuBar';
import SearchableSelect from '../../../components/ui/SearchableSelect';
import { useClinicStore } from '../../../store/useClinicStore';
import OpdAdmitReportImportModal from './OpdAdmitReportImportModal';
import '../reports/ConsultantWiseFilter.scss';
import './OpdAdmitReport.scss';

const todayIso = () => new Date().toISOString().slice(0, 10);

// Panels > Reports > OPD Admit Report — filter step (owner's report format:
// filter screen first, then the preview). Same fields/defaults as the old
// "Panel Report" pop-up, which matched the legacy dialog exactly: Admission/
// OPD picks which patient universe, Discharge/Admit picks which date the
// From/To range applies to, an optional Company narrows it, and Details/
// Headers/Summary/With Slip picks the output shape. OK opens
// OpdAdmitReport at /view.
export default function OpdAdmitReportFilter() {
  const navigate = useNavigate();
  const { panelCompanies, fetchPanelCompanies } = useClinicStore();

  const [scopeType, setScopeType] = useState('admission'); // admission | opd
  const [dateType, setDateType] = useState('discharge'); // discharge | admit
  // Wide-open by default (this report's data is legacy/bulk-imported, not
  // "today"-centric) — narrows to today-today would silently show zero rows
  // right after a fresh import. User can tighten the range from here.
  const [fromDate, setFromDate] = useState('2000-01-01');
  const [toDate, setToDate] = useState(todayIso());
  const [companyId, setCompanyId] = useState('ALL');
  // Defaults to 'details' rather than the legacy dialog's own 'headers'
  // default — only Details is actually wired up so far, and defaulting into
  // an unbuilt stub would hide real data.
  const [viewMode, setViewMode] = useState('details'); // details | headers | summary | withSlip

  const [showImport, setShowImport] = useState(false);

  useEffect(() => { fetchPanelCompanies(); }, [fetchPanelCompanies]);

  function handlePreview() {
    const q = new URLSearchParams({ scopeType, dateType, fromDate, toDate, companyId: companyId || 'ALL', viewMode });
    navigate(`/clinic/panels/opd-admit-report/view?${q}`);
  }

  return (
    <div className="cwf-page oar-filter-page">
      <ClinicMenuBar />

      <div className="cwf-center">
        <div className="cwf-window">
          <div className="cwf-titlebar">
            <span className="cwf-title-left">Reports — OPD Admit Report</span>
            <span className="cwf-title-right">OPD Admit Report</span>
          </div>

          <div className="cwf-body">
            <div className="cwf-row">
              <label className="cwf-lbl">Patients</label>
              <div className="cwf-radios">
                {[['admission', 'Admission'], ['opd', 'OPD']].map(([v, l]) => (
                  <label key={v} className="cwf-radio-label">
                    <input type="radio" name="oar-scope" value={v} checked={scopeType === v} onChange={() => setScopeType(v)} />
                    {l}
                  </label>
                ))}
              </div>
            </div>

            <div className="cwf-row">
              <label className="cwf-lbl">Date On</label>
              <div className="cwf-radios">
                {[['discharge', 'Discharge'], ['admit', 'Admit']].map(([v, l]) => (
                  <label key={v} className="cwf-radio-label">
                    <input type="radio" name="oar-datetype" value={v} checked={dateType === v} onChange={() => setDateType(v)} />
                    {l}
                  </label>
                ))}
              </div>
            </div>

            <div className="cwf-row">
              <label className="cwf-lbl">Date</label>
              <div className="cwf-field-group">
                <span className="cwf-sub-lbl">From</span>
                <input type="date" className="cwf-input" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              </div>
              <div className="cwf-field-group">
                <span className="cwf-sub-lbl">To</span>
                <input type="date" className="cwf-input" value={toDate} onChange={(e) => setToDate(e.target.value)} />
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
              {[['details', 'Details'], ['headers', 'Headers'], ['summary', 'Summary'], ['withSlip', 'With Slip']].map(([v, l]) => (
                <label key={v} className="cwf-radio-label">
                  <input type="radio" name="oar-viewmode" value={v} checked={viewMode === v} onChange={() => setViewMode(v)} />
                  {l}
                </label>
              ))}
            </div>

            <div className="cwf-actions">
              <button type="button" className="cwf-btn oar-btn-icon" onClick={() => setShowImport(true)}><Upload size={13} /> Upload Excel</button>
              <button type="button" className="cwf-btn cwf-btn--ok" onClick={handlePreview}>OK</button>
              <button type="button" className="cwf-btn" onClick={() => navigate(-1)}>Close</button>
            </div>
          </div>
        </div>
      </div>

      {showImport && (
        <OpdAdmitReportImportModal onClose={() => setShowImport(false)} />
      )}
    </div>
  );
}
