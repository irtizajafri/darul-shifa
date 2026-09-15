import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import ClinicMenuBar from '../../../components/clinic/ClinicMenuBar';
import './ConsultantWiseFilter.scss';
import './WardWiseBillFilter.scss';

const API = 'http://localhost:5001/api/clinic';

const todayStr = () => new Date().toISOString().split('T')[0];
const firstOfMonthStr = () => { const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0]; };

// Matches the patientCategory values already used everywhere else
// (ClinicAdmission.patientCategory / AdmissionWiseFilter's PATIENT_TYPES) —
// this screen just doesn't offer the "CC" option the legacy screenshot skips.
const PATIENT_TYPES = [
  ['private', 'Cash'], ['staff', 'Staff'], ['panel', 'Panel'], ['complementary', 'Complimentary'],
];

export default function WardWiseBillFilter() {
  const navigate = useNavigate();

  const [billType, setBillType] = useState('provisional'); // provisional | final
  const [withSummary, setWithSummary] = useState(true);

  const [allTypes, setAllTypes] = useState(true);
  const [types, setTypes] = useState([]);

  const [dateMode, setDateMode] = useState('discharge'); // discharge | admit
  const [fromEnabled, setFromEnabled] = useState(true);
  const [toEnabled, setToEnabled] = useState(true);
  const [fromDate, setFromDate] = useState(firstOfMonthStr());
  const [toDate, setToDate] = useState(todayStr());

  const [wards, setWards] = useState([]);
  const [ward, setWard] = useState('ALL');

  const [billHeads, setBillHeads] = useState([]);
  const [headFind, setHeadFind] = useState('');
  const [allHeads, setAllHeads] = useState(true);
  const [selectedHeads, setSelectedHeads] = useState(new Set());

  const [doctors, setDoctors] = useState([]);
  const [allConsultants, setAllConsultants] = useState(true);
  const [selectedConsultants, setSelectedConsultants] = useState(new Set());

  useEffect(() => {
    fetch(`${API}/room-categories`).then(r => r.json()).then(j => setWards(j.data || [])).catch(() => {});
    fetch(`${API}/bill-heads`).then(r => r.json())
      .then(j => setBillHeads((j.data || []).filter(h => h.status === 'active')))
      .catch(() => {});
    fetch(`${API}/doctors?minimal=true`).then(r => r.json())
      .then(j => setDoctors((j.data || []).filter(d => d.status === 'active')))
      .catch(() => {});
  }, []);

  const filteredHeads = useMemo(() => {
    const q = headFind.trim().toLowerCase();
    if (!q) return billHeads;
    return billHeads.filter(h => h.description.toLowerCase().includes(q) || h.headCode.toLowerCase().includes(q));
  }, [billHeads, headFind]);

  const togglePatientType = (v) => {
    setTypes(prev => (prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]));
  };

  const toggleHead = (id) => {
    setSelectedHeads(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleConsultant = (id) => {
    setSelectedConsultants(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handlePreview = () => {
    const params = new URLSearchParams({
      billType,
      withSummary: withSummary ? '1' : '0',
      patientTypes: allTypes ? 'ALL' : types.join(','),
      dateMode,
      fromDate: fromEnabled ? fromDate : '',
      toDate: toEnabled ? toDate : '',
      ward,
      billHeads: allHeads ? 'ALL' : [...selectedHeads].join(','),
      consultants: allConsultants ? 'ALL' : [...selectedConsultants].join(','),
    });
    navigate(`/clinic/reports/ward-wise-bill/view?${params}`);
  };

  return (
    <div className="cwf-page">
      <ClinicMenuBar />

      <div className="cwf-center">
        <div className="cwf-window wwb-window">
          <div className="cwf-titlebar">
            <span className="cwf-title-left">Reports — Ward Wise Bill</span>
            <span className="cwf-title-right">Ward Wise Bill Report</span>
          </div>

          <div className="cwf-body">
            {/* Bill Type */}
            <fieldset className="cwf-fieldset">
              <legend className="cwf-legend">Bill Type</legend>
              <div className="wwb-billtype-row">
                <label className="cwf-radio-label">
                  <input type="radio" name="billType" checked={billType === 'provisional'} onChange={() => setBillType('provisional')} />
                  Provisional Bill
                </label>
                <label className="cwf-radio-label">
                  <input type="radio" name="billType" checked={billType === 'final'} onChange={() => setBillType('final')} />
                  Final Bill
                </label>
                <label className="cwf-chk-label wwb-summary-chk">
                  <input type="checkbox" checked={withSummary} onChange={e => setWithSummary(e.target.checked)} />
                  With Summary
                </label>
              </div>
            </fieldset>

            {/* Patient type */}
            <div className="wwb-types-row">
              <label className="cwf-chk-label">
                <input
                  type="checkbox"
                  checked={allTypes}
                  onChange={e => { setAllTypes(e.target.checked); if (e.target.checked) setTypes([]); }}
                />
                All
              </label>
              {PATIENT_TYPES.map(([v, l]) => (
                <label key={v} className="cwf-chk-label">
                  <input
                    type="checkbox"
                    disabled={allTypes}
                    checked={types.includes(v)}
                    onChange={() => togglePatientType(v)}
                  />
                  {l}
                </label>
              ))}
            </div>

            {/* Date */}
            <div className="cwf-row wwb-date-row">
              <select className="cwf-input wwb-date-select" value={dateMode} onChange={e => setDateMode(e.target.value)}>
                <option value="discharge">Discharge Date</option>
                <option value="admit">Admit Date</option>
              </select>
              <label className="cwf-chk-label">
                <input type="checkbox" checked={fromEnabled} onChange={e => setFromEnabled(e.target.checked)} />
                From
              </label>
              <input type="date" className="cwf-input" disabled={!fromEnabled} value={fromDate} onChange={e => setFromDate(e.target.value)} />
              <label className="cwf-chk-label">
                <input type="checkbox" checked={toEnabled} onChange={e => setToEnabled(e.target.checked)} />
                To
              </label>
              <input type="date" className="cwf-input" disabled={!toEnabled} value={toDate} onChange={e => setToDate(e.target.value)} />
            </div>

            {/* Wards */}
            <div className="cwf-row">
              <label className="cwf-lbl wwb-lbl-wide">Wards :</label>
              <select className="cwf-input wwb-ward-select" value={ward} onChange={e => setWard(e.target.value)}>
                <option value="ALL">ALL</option>
                {wards.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>

            {/* Discharge Head + Consultants checklists */}
            <div className="wwb-lists-row">
              <div className="wwb-list-box">
                <div className="wwb-list-title">Discharge Head</div>
                <div className="wwb-list-find">
                  <span className="wwb-find-lbl">Find :</span>
                  <input
                    type="text"
                    className="cwf-input wwb-find-input"
                    value={headFind}
                    onChange={e => setHeadFind(e.target.value)}
                  />
                  <button
                    type="button"
                    className="cwf-btn wwb-clearall-btn"
                    onClick={() => { setAllHeads(true); setSelectedHeads(new Set()); setHeadFind(''); }}
                  >
                    Clear All
                  </button>
                </div>
                <div className="wwb-checklist">
                  <label className="wwb-check-row wwb-check-row--all">
                    <input
                      type="checkbox"
                      checked={allHeads}
                      onChange={e => { setAllHeads(e.target.checked); if (e.target.checked) setSelectedHeads(new Set()); }}
                    />
                    ALL
                  </label>
                  {filteredHeads.map(h => (
                    <label key={h.id} className="wwb-check-row">
                      <input
                        type="checkbox"
                        disabled={allHeads}
                        checked={selectedHeads.has(h.id)}
                        onChange={() => toggleHead(h.id)}
                      />
                      {h.description} - {h.headCode}
                    </label>
                  ))}
                  {filteredHeads.length === 0 && <div className="wwb-empty">No bill head matches</div>}
                </div>
              </div>

              <div className="wwb-list-box">
                <div className="wwb-list-title">Consultants</div>
                <div className="wwb-checklist wwb-checklist--consultants">
                  <label className="wwb-check-row wwb-check-row--all">
                    <input
                      type="checkbox"
                      checked={allConsultants}
                      onChange={e => { setAllConsultants(e.target.checked); if (e.target.checked) setSelectedConsultants(new Set()); }}
                    />
                    ALL
                  </label>
                  {doctors.map(d => (
                    <label key={d.id} className="wwb-check-row">
                      <input
                        type="checkbox"
                        disabled={allConsultants}
                        checked={selectedConsultants.has(d.id)}
                        onChange={() => toggleConsultant(d.id)}
                      />
                      {d.name} - {d.code}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="cwf-actions">
              <button className="cwf-btn cwf-btn--ok" onClick={handlePreview}>Preview</button>
              <button className="cwf-btn" onClick={() => navigate(-1)}>Back</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
