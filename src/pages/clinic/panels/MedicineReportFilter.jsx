import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Search, Upload, X } from 'lucide-react';
import ClinicMenuBar from '../../../components/clinic/ClinicMenuBar';
import SearchableSelect from '../../../components/ui/SearchableSelect';
import { useClinicStore } from '../../../store/useClinicStore';
import useModalKeys from '../../../hooks/useModalKeys';
import MedicineReportImportModal from './MedicineReportImportModal';
import '../reports/ConsultantWiseFilter.scss';
// Still needed for the Company picker pop-up (.mrp-modal-overlay / .mrp-picker-*).
import './MedicineReport.scss';
import { useShallow } from 'zustand/react/shallow';

// Radio + caption in the dark-red label column (wider than .cwf-lbl's 80px).
const RADIO_LBL = { width: 120, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, cursor: 'pointer' };
const ICON_BTN = { minWidth: 0, padding: '3px 7px', display: 'inline-flex', alignItems: 'center' };

const todayIso = () => new Date().toISOString().slice(0, 10);

// Panels > Reports > Medicine Report — filter step (owner's report format:
// filter screen first, then the preview). Same fields/defaults as the old
// "Medican Report" pop-up: Admission # (exact) OR a date-range (by
// Admission/Discharge Date, today) scope the report, an optional Company
// narrows it further, Details vs Admit-wise Summary picks the output shape,
// plus the Medical Store. View opens MedicineReport at /view.
export default function MedicineReportFilter() {
  const navigate = useNavigate();
  const { panelCompanies, fetchPanelCompanies, pharmacyStores, fetchPharmacyStores } = useClinicStore(useShallow((s) => ({ panelCompanies: s.panelCompanies, fetchPanelCompanies: s.fetchPanelCompanies, pharmacyStores: s.pharmacyStores, fetchPharmacyStores: s.fetchPharmacyStores })));

  const [scopeMode, setScopeMode] = useState('date'); // 'admission' | 'date'
  const [admissionNo, setAdmissionNo] = useState('');
  const [dateType, setDateType] = useState('discharge'); // 'admission' | 'discharge'
  const [fromDate, setFromDate] = useState(todayIso());
  const [toDate, setToDate] = useState(todayIso());

  const [companyId, setCompanyId] = useState('');
  const [showCompanyPicker, setShowCompanyPicker] = useState(false);

  const [viewMode, setViewMode] = useState('details'); // 'details' | 'summary'
  // Medical Store (Parameters > Pharmacy Stores) — 'ALL' | 'hospital' | store id.
  const [storeFilter, setStoreFilter] = useState('ALL');

  const [showImport, setShowImport] = useState(false);

  useEffect(() => { fetchPanelCompanies(); fetchPharmacyStores(); }, [fetchPanelCompanies, fetchPharmacyStores]);

  const selectedCompany = panelCompanies.find((c) => String(c.id) === String(companyId));
  const storeOptions = [
    { id: 'ALL', label: 'ALL' },
    // Pharmacy Stores usually already has a "HOSPITAL STORE" — only add our
    // own In-House option when it doesn't.
    ...(pharmacyStores.some((s) => /hospital/i.test(s.name)) ? [] : [{ id: 'hospital', label: 'Hospital Store' }]),
    ...pharmacyStores.map((s) => ({ id: String(s.id), label: s.status === 'inactive' ? `${s.name} (inactive)` : s.name })),
  ];

  function handleView() {
    if (scopeMode === 'admission' && !admissionNo.trim()) {
      toast.error('Admission # darj karein');
      return;
    }
    if (scopeMode === 'date' && (!fromDate || !toDate)) {
      toast.error('From/To date select karein');
      return;
    }
    const q = new URLSearchParams({
      scopeMode, admissionNo: admissionNo.trim(), dateType, fromDate, toDate,
      companyId, viewMode, storeFilter,
    });
    navigate(`/clinic/panels/medicine-report/view?${q}`);
  }

  return (
    <div className="cwf-page">
      <ClinicMenuBar />

      <div className="cwf-center">
        <div className="cwf-window">
          <div className="cwf-titlebar">
            <span className="cwf-title-left">Reports — Medicine Report</span>
            <span className="cwf-title-right">Medicine Report</span>
          </div>

          <div className="cwf-body">
            <div className="cwf-row">
              <label className="cwf-lbl" style={RADIO_LBL}>
                <input type="radio" name="mrp-scope" checked={scopeMode === 'admission'} onChange={() => setScopeMode('admission')} />
                Admission #
              </label>
              <input
                className="cwf-input"
                value={admissionNo}
                onChange={(e) => setAdmissionNo(e.target.value)}
                disabled={scopeMode !== 'admission'}
                onFocus={() => setScopeMode('admission')}
              />
            </div>

            <div className="cwf-row">
              <label className="cwf-lbl" style={RADIO_LBL}>
                <input type="radio" name="mrp-scope" checked={scopeMode === 'date'} onChange={() => setScopeMode('date')} />
                Date
              </label>
              <select
                className="cwf-input"
                style={{ width: 145 }}
                value={dateType}
                onChange={(e) => { setDateType(e.target.value); setScopeMode('date'); }}
                disabled={scopeMode !== 'date'}
              >
                <option value="admission">Admission Date</option>
                <option value="discharge">Discharge Date</option>
              </select>
              <div className="cwf-field-group">
                <span className="cwf-sub-lbl">From</span>
                <input
                  type="date" className="cwf-input" style={{ width: 150 }} value={fromDate}
                  onChange={(e) => { setFromDate(e.target.value); setScopeMode('date'); }}
                  disabled={scopeMode !== 'date'}
                />
              </div>
              <div className="cwf-field-group">
                <span className="cwf-sub-lbl">To</span>
                <input
                  type="date" className="cwf-input" style={{ width: 150 }} value={toDate}
                  onChange={(e) => { setToDate(e.target.value); setScopeMode('date'); }}
                  disabled={scopeMode !== 'date'}
                />
              </div>
            </div>

            <div className="cwf-row">
              <label className="cwf-lbl" style={{ width: 120 }}>Company</label>
              <input
                className="cwf-input"
                style={{ width: 300, cursor: 'pointer' }}
                readOnly
                value={selectedCompany ? `${selectedCompany.code} — ${selectedCompany.name}` : ''}
                placeholder="— Sab companies —"
                onClick={() => setShowCompanyPicker(true)}
              />
              {selectedCompany && (
                <button className="cwf-btn" style={ICON_BTN} onClick={() => setCompanyId('')} title="Clear">✕</button>
              )}
              <button className="cwf-btn" style={ICON_BTN} onClick={() => setShowCompanyPicker(true)} title="Search company"><Search size={13} /></button>
            </div>

            <div className="cwf-row">
              <label className="cwf-lbl" style={{ width: 120 }}>Medical Store</label>
              <SearchableSelect
                options={storeOptions}
                value={storeFilter}
                onChange={(v) => setStoreFilter(v || 'ALL')}
                getKey={(o) => o.id}
                getLabel={(o) => o.label}
                placeholder="Medical Store"
                title="Medical Store"
                clearable={false}
                size="sm"
                style={{ width: 300 }}
              />
            </div>

            <div className="cwf-radios">
              <label className="cwf-radio-label">
                <input type="radio" name="mrp-viewmode" checked={viewMode === 'details'} onChange={() => setViewMode('details')} />
                Details
              </label>
              <label className="cwf-radio-label">
                <input type="radio" name="mrp-viewmode" checked={viewMode === 'summary'} onChange={() => setViewMode('summary')} />
                Admit wise Summary
              </label>
            </div>

            <div className="cwf-actions">
              <button className="cwf-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }} onClick={() => setShowImport(true)}><Upload size={13} /> Upload Excel</button>
              <button className="cwf-btn cwf-btn--ok" onClick={handleView}>OK</button>
              <button className="cwf-btn" onClick={() => navigate(-1)}>Close</button>
            </div>
          </div>
        </div>
      </div>

      {showCompanyPicker && (
        <CompanyPickerModal
          companies={panelCompanies}
          onSelect={(c) => { setCompanyId(String(c.id)); setShowCompanyPicker(false); }}
          onClose={() => setShowCompanyPicker(false)}
        />
      )}

      {showImport && (
        <MedicineReportImportModal onClose={() => setShowImport(false)} />
      )}
    </div>
  );
}

function CompanyPickerModal({ companies, onSelect, onClose }) {
  const [q, setQ] = useState('');
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useModalKeys({ active: true, onEsc: onClose });

  const filtered = companies.filter((c) =>
    !q.trim() ||
    c.name.toLowerCase().includes(q.trim().toLowerCase()) ||
    c.code.toLowerCase().includes(q.trim().toLowerCase())
  );

  return (
    <div className="mrp-modal-overlay" onMouseDown={onClose}>
      <div className="mrp-modal mrp-modal--picker" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
        <div className="mrp-modal-head">
          <span>Select Company</span>
          <button onClick={onClose} aria-label="Close" title="Close"><X size={16} /></button>
        </div>
        <div className="mrp-picker-search">
          <Search size={13} />
          <input ref={inputRef} placeholder="Search company…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="mrp-picker-list">
          {filtered.length === 0 ? (
            <div className="mrp-picker-empty">Koi company nahi mili</div>
          ) : filtered.map((c) => (
            <div key={c.id} className="mrp-picker-row" onClick={() => onSelect(c)}>
              <span className="mrp-picker-code">{c.code}</span>
              <span className="mrp-picker-name">{c.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
