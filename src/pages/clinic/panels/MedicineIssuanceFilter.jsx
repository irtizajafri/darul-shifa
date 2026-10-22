import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Upload } from 'lucide-react';
import ClinicMenuBar from '../../../components/clinic/ClinicMenuBar';
import SearchableSelect from '../../../components/ui/SearchableSelect';
import { useClinicStore } from '../../../store/useClinicStore';
import MedicineIssuanceImportModal from './MedicineIssuanceImportModal';
import '../reports/ConsultantWiseFilter.scss';
import { useShallow } from 'zustand/react/shallow';

// Radio + caption in the dark-red label column (wider than .cwf-lbl's 80px).
const RADIO_LBL = { width: 120, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, cursor: 'pointer' };

const todayIso = () => new Date().toISOString().slice(0, 10);

// Clinic > Report > Medicine Issuance — filter step (owner's report format:
// filter screen first, then the preview). Same fields/defaults as the old
// filter pop-up: Admission # (exact) OR a date-range (by Medicine/Admission/
// Discharge Date, today) scope the report, plus the Medical Store and
// Details vs Admit-wise Summary. View opens MedicineIssuanceTransaction at
// /view?scopeMode&admissionNo&dateType&fromDate&toDate&storeFilter&viewMode.
export default function MedicineIssuanceFilter() {
  const navigate = useNavigate();
  const { pharmacyStores, fetchPharmacyStores } = useClinicStore(useShallow((s) => ({ pharmacyStores: s.pharmacyStores, fetchPharmacyStores: s.fetchPharmacyStores })));

  const [scopeMode, setScopeMode] = useState('date'); // 'admission' | 'date'
  const [admissionNo, setAdmissionNo] = useState('');
  const [dateType, setDateType] = useState('medicine'); // 'admission' | 'discharge' | 'medicine'
  const [fromDate, setFromDate] = useState(todayIso());
  const [toDate, setToDate] = useState(todayIso());

  const [storeFilter, setStoreFilter] = useState('ALL'); // 'ALL' | 'hospital' | store id
  const [viewMode, setViewMode] = useState('details'); // 'details' | 'summary'

  const [showImport, setShowImport] = useState(false);

  useEffect(() => { fetchPharmacyStores(); }, [fetchPharmacyStores]);

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
      storeFilter, viewMode,
    });
    navigate(`/clinic/reports/medicine-issuance/view?${q}`);
  }

  return (
    <div className="cwf-page">
      <ClinicMenuBar />

      <div className="cwf-center">
        <div className="cwf-window">
          <div className="cwf-titlebar">
            <span className="cwf-title-left">Reports — Medicine Issuance</span>
            <span className="cwf-title-right">Medicine Issuance</span>
          </div>

          <div className="cwf-body">
            <div className="cwf-row">
              <label className="cwf-lbl" style={RADIO_LBL}>
                <input type="radio" name="mit-scope" checked={scopeMode === 'admission'} onChange={() => setScopeMode('admission')} />
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
                <input type="radio" name="mit-scope" checked={scopeMode === 'date'} onChange={() => setScopeMode('date')} />
                Date
              </label>
              <select
                className="cwf-input"
                style={{ width: 145 }}
                value={dateType}
                onChange={(e) => { setDateType(e.target.value); setScopeMode('date'); }}
                disabled={scopeMode !== 'date'}
              >
                <option value="medicine">Medicine Date</option>
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
              <label className="cwf-lbl" style={{ width: 120 }}>Medical Store</label>
              <SearchableSelect
                options={storeOptions}
                value={storeFilter}
                onChange={(v) => setStoreFilter(v || 'ALL')}
                getKey={(o) => o.id}
                getLabel={(o) => o.label}
                clearable={false}
                size="sm"
                style={{ width: 300 }}
              />
            </div>

            <div className="cwf-radios">
              <label className="cwf-radio-label">
                <input type="radio" name="mit-viewmode" checked={viewMode === 'details'} onChange={() => setViewMode('details')} />
                Details
              </label>
              <label className="cwf-radio-label">
                <input type="radio" name="mit-viewmode" checked={viewMode === 'summary'} onChange={() => setViewMode('summary')} />
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

      {showImport && (
        <MedicineIssuanceImportModal onClose={() => setShowImport(false)} />
      )}
    </div>
  );
}
