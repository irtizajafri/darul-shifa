import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ClinicMenuBar from '../../../components/clinic/ClinicMenuBar';
import './ConsultantWiseFilter.scss';
import './AdmissionDistributionFilter.scss';

const API = 'http://localhost:5001/api/clinic';

const todayStr = () => new Date().toISOString().split('T')[0];
const firstOfMonthStr = () => { const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0]; };

const STYLES = [
  ['matrix', 'Matrix'],
  ['pageLayout', 'Page Layout'],
  ['summary', 'Summary'],
  ['billHeadWise', 'Bill Head wise Distribution'],
];

export default function AdmissionDistributionFilter() {
  const navigate = useNavigate();

  const [billHeads, setBillHeads] = useState([]);

  const [admissionFrom, setAdmissionFrom] = useState('');
  const [admissionTo, setAdmissionTo] = useState('');

  const [billHeadFrom, setBillHeadFrom] = useState('');
  const [billHeadTo, setBillHeadTo] = useState('');

  const [closingFrom, setClosingFrom] = useState(firstOfMonthStr());
  const [closingTo, setClosingTo] = useState(todayStr());

  const [reportStyle, setReportStyle] = useState('pageLayout');

  useEffect(() => {
    fetch(`${API}/bill-heads`)
      .then(r => r.json())
      .then(j => setBillHeads((j.data || []).filter(h => h.status === 'active')))
      .catch(() => {});
  }, []);

  const handlePreview = () => {
    const fromHead = billHeads.find(h => String(h.id) === billHeadFrom);
    const toHead = billHeads.find(h => String(h.id) === billHeadTo);
    const params = new URLSearchParams({
      admissionFrom, admissionTo,
      billHeadFromCode: fromHead?.headCode || '',
      billHeadToCode: toHead?.headCode || '',
      closingFrom, closingTo,
      reportStyle,
    });
    navigate(`/clinic/reports/admission-distribution/view?${params}`);
  };

  return (
    <div className="cwf-page">
      <ClinicMenuBar />

      <div className="cwf-center">
        <div className="cwf-window adf-window">
          <div className="cwf-titlebar">
            <span className="cwf-title-left">Reports — Admission Distribution</span>
            <span className="cwf-title-right">Admission Distribution</span>
          </div>

          <div className="cwf-body">

            <div className="adf-fromto-labels">
              <span className="adf-fromto-lbl">From</span>
              <span className="adf-fromto-lbl">To</span>
            </div>

            <div className="cwf-row">
              <label className="cwf-lbl">Admission #</label>
              <input type="text" className="cwf-input adf-half" placeholder="(first)" value={admissionFrom} onChange={e => setAdmissionFrom(e.target.value)} />
              <input type="text" className="cwf-input adf-half" placeholder="(last)" value={admissionTo} onChange={e => setAdmissionTo(e.target.value)} />
            </div>

            <div className="cwf-row">
              <label className="cwf-lbl">Bill Heads</label>
              <select className="cwf-input adf-half" value={billHeadFrom} onChange={e => setBillHeadFrom(e.target.value)}>
                <option value="">(first)</option>
                {billHeads.map(h => <option key={h.id} value={h.id}>{h.headCode} - {h.description}</option>)}
              </select>
              <select className="cwf-input adf-half" value={billHeadTo} onChange={e => setBillHeadTo(e.target.value)}>
                <option value="">(last)</option>
                {billHeads.map(h => <option key={h.id} value={h.id}>{h.headCode} - {h.description}</option>)}
              </select>
            </div>

            <div className="cwf-row">
              <label className="cwf-lbl">Closing Date</label>
              <input type="date" className="cwf-input adf-half" value={closingFrom} onChange={e => setClosingFrom(e.target.value)} />
              <input type="date" className="cwf-input adf-half" value={closingTo} onChange={e => setClosingTo(e.target.value)} />
            </div>

            <div className="cwf-radios">
              {STYLES.map(([v, l]) => (
                <label key={v} className="cwf-radio-label">
                  <input type="radio" name="reportStyle" value={v} checked={reportStyle === v} onChange={() => setReportStyle(v)} />
                  {l}
                </label>
              ))}
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
