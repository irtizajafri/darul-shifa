import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import ClinicMenuBar from '../../../components/clinic/ClinicMenuBar';
import SearchableSelect from '../../../components/ui/SearchableSelect';
import { useClinicStore } from '../../../store/useClinicStore';
import '../reports/ConsultantWiseFilter.scss';
import { useShallow } from 'zustand/react/shallow';

const isoDay = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Panels > Reports > Bill Comparison Report — filter step, laid out like the
// legacy "Bill Report" dialog (owner, 2026-10-26): Admission/OPD, From/To,
// Company, ALL/Billed/Unbilled. Preview opens BillComparisonReport at /view.
export default function BillComparisonFilter() {
  const navigate = useNavigate();
  const { panelCompanies, fetchPanelCompanies } = useClinicStore(useShallow((s) => ({ panelCompanies: s.panelCompanies, fetchPanelCompanies: s.fetchPanelCompanies })));

  const today = new Date();
  const [mode, setMode] = useState('admission'); // admission | opd
  const [fromDate, setFromDate] = useState(isoDay(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [toDate, setToDate] = useState(isoDay(today));
  const [companyId, setCompanyId] = useState('ALL');
  const [billed, setBilled] = useState('all'); // all | billed | unbilled

  useEffect(() => { fetchPanelCompanies(); }, [fetchPanelCompanies]);

  function handlePreview() {
    if (!fromDate || !toDate) { toast.error('From aur To date select karein'); return; }
    if (fromDate > toDate) { toast.error('From date, To date se pehle honi chahiye'); return; }
    const q = new URLSearchParams({ mode, from: fromDate, to: toDate, companyId: companyId || 'ALL', billed });
    navigate(`/clinic/panels/bill-comparison/view?${q}`);
  }

  return (
    <div className="cwf-page">
      <ClinicMenuBar />

      <div className="cwf-center">
        <div className="cwf-window">
          <div className="cwf-titlebar">
            <span className="cwf-title-left">Reports — Bill Comparison Report</span>
            <span className="cwf-title-right">Bill Report</span>
          </div>

          <div className="cwf-body">
            <div className="cwf-radios">
              {[['admission', 'Admission'], ['opd', 'OPD']].map(([v, l]) => (
                <label key={v} className="cwf-radio-label">
                  <input type="radio" name="bcr-mode" value={v} checked={mode === v} onChange={() => setMode(v)} />
                  {l}
                </label>
              ))}
            </div>

            <div className="cwf-row">
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
              {[['all', 'ALL'], ['billed', 'Billed'], ['unbilled', 'Unbilled']].map(([v, l]) => (
                <label key={v} className="cwf-radio-label">
                  <input type="radio" name="bcr-billed" value={v} checked={billed === v} onChange={() => setBilled(v)} />
                  {l}
                </label>
              ))}
            </div>

            <div className="cwf-actions">
              <button type="button" className="cwf-btn cwf-btn--ok" onClick={handlePreview}>Preview</button>
              <button type="button" className="cwf-btn" onClick={() => navigate(-1)}>Close</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
