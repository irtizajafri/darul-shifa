import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ClinicMenuBar from '../../../components/clinic/ClinicMenuBar';
import './ConsultantWiseFilter.scss';
import './WardWisePaymentDistributionFilter.scss';

const API = 'http://localhost:5001/api/clinic';

const todayStr = () => new Date().toISOString().split('T')[0];
const daysAgoStr = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().split('T')[0]; };

export default function WardWisePaymentDistributionFilter() {
  const navigate = useNavigate();

  const [wards, setWards] = useState([]);
  const [selectedWards, setSelectedWards] = useState(new Set());

  const [admissionFrom, setAdmissionFrom] = useState('');
  const [admissionTo, setAdmissionTo] = useState('');

  const [dateFrom, setDateFrom] = useState(daysAgoStr(30));
  const [dateTo, setDateTo] = useState(todayStr());

  const [salary, setSalary] = useState('');
  const [sharePercent, setSharePercent] = useState('');
  const [otherAdd, setOtherAdd] = useState('');
  const [otherLess, setOtherLess] = useState('');

  const [includeEmergency, setIncludeEmergency] = useState(false);
  const [includeIndoor, setIncludeIndoor] = useState(false);

  useEffect(() => {
    fetch(`${API}/room-categories`)
      .then(r => r.json())
      .then(j => {
        const list = j.data || [];
        setWards(list);
        setSelectedWards(new Set(list.map(w => w.id))); // all checked by default
      })
      .catch(() => {});
  }, []);

  const toggleWard = (id) => {
    setSelectedWards(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handlePreview = () => {
    if (!selectedWards.size) { return; }
    const params = new URLSearchParams({
      admissionFrom, admissionTo, dateFrom, dateTo,
      wardIds: [...selectedWards].join(','),
      salary, sharePercent, otherAdd, otherLess,
      includeEmergency: includeEmergency ? '1' : '0',
      includeIndoor: includeIndoor ? '1' : '0',
    });
    navigate(`/clinic/reports/ward-wise-payment-distribution/view?${params}`);
  };

  return (
    <div className="cwf-page">
      <ClinicMenuBar />

      <div className="cwf-center">
        <div className="cwf-window wpd-window">
          <div className="cwf-titlebar">
            <span className="cwf-title-left">Reports — Ward Wise Payment Distribution</span>
            <span className="cwf-title-right">Ward Wise Payment Distribution</span>
          </div>

          <div className="cwf-body">

            <div className="wpd-fromto-labels">
              <span className="wpd-fromto-lbl">From</span>
              <span className="wpd-fromto-lbl">To</span>
            </div>

            <div className="cwf-row">
              <label className="cwf-lbl">Admission #</label>
              <input type="text" className="cwf-input wpd-half" placeholder="(first)" value={admissionFrom} onChange={e => setAdmissionFrom(e.target.value)} />
              <input type="text" className="cwf-input wpd-half" placeholder="999999999" value={admissionTo} onChange={e => setAdmissionTo(e.target.value)} />
            </div>

            <div className="cwf-row">
              <label className="cwf-lbl">Date</label>
              <input type="date" className="cwf-input wpd-half" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
              <input type="date" className="cwf-input wpd-half" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>

            <div className="wpd-wards-block">
              <label className="wpd-wards-lbl">Wards</label>
              <div className="wpd-checklist">
                {wards.map(w => (
                  <label key={w.id} className="wpd-check-row">
                    <input type="checkbox" checked={selectedWards.has(w.id)} onChange={() => toggleWard(w.id)} />
                    {w.code} - {w.name}
                  </label>
                ))}
                {!wards.length && <div className="wpd-empty">Loading wards…</div>}
              </div>
            </div>

            <div className="wpd-calc-grid">
              <div className="cwf-row">
                <label className="cwf-lbl">Salary</label>
                <input type="number" className="cwf-input wpd-calc-input" value={salary} onChange={e => setSalary(e.target.value)} />
                <label className="cwf-lbl wpd-lbl2">Other (Add)</label>
                <input type="number" className="cwf-input wpd-calc-input" value={otherAdd} onChange={e => setOtherAdd(e.target.value)} />
              </div>
              <div className="cwf-row">
                <label className="cwf-lbl">Share %</label>
                <input type="number" className="cwf-input wpd-calc-input" value={sharePercent} onChange={e => setSharePercent(e.target.value)} />
                <label className="cwf-lbl wpd-lbl2">Other (Less)</label>
                <input type="number" className="cwf-input wpd-calc-input" value={otherLess} onChange={e => setOtherLess(e.target.value)} />
              </div>
            </div>

            <div className="wpd-toggles">
              <label className="cwf-chk-label">
                <input type="checkbox" checked={includeEmergency} onChange={e => setIncludeEmergency(e.target.checked)} />
                Include Emergency
              </label>
              <label className="cwf-chk-label">
                <input type="checkbox" checked={includeIndoor} onChange={e => setIncludeIndoor(e.target.checked)} />
                Include Indoor
              </label>
            </div>

            <div className="cwf-actions">
              <button className="cwf-btn cwf-btn--ok" onClick={handlePreview}>Preview</button>
              <button className="cwf-btn" onClick={() => navigate(-1)}>Close</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
