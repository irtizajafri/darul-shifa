import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import ClinicMenuBar from '../../../components/clinic/ClinicMenuBar';
import SearchableSelect from '../../../components/ui/SearchableSelect';
import './ConsultantWiseFilter.scss';

const API = 'http://localhost:5001/api/clinic';
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Reports — General Payment Date Wise: payments still in Pending Draft
// (real time, before Day Close). Filters: Date range + Consultant.
export default function GeneralPaymentFilter() {
  const navigate = useNavigate();
  const [fromDate, setFromDate] = useState(() => ymd(new Date()));
  const [toDate, setToDate] = useState(() => ymd(new Date()));
  const [doctorId, setDoctorId] = useState('');
  const [doctors, setDoctors] = useState([]);

  useEffect(() => {
    fetch(`${API}/doctors?minimal=true`)
      .then(r => r.json())
      .then(j => setDoctors((j.data || []).filter(d => d.status !== 'inactive')))
      .catch(() => toast.error('Consultants load nahi hue'));
  }, []);

  const handleOk = () => {
    const params = new URLSearchParams({ fromDate, toDate });
    if (doctorId) params.set('doctorId', doctorId);
    navigate(`/clinic/reports/general-payment/view?${params}`);
  };

  return (
    <div className="cwf-page">
      <ClinicMenuBar />

      <div className="cwf-center">
        <div className="cwf-window">
          <div className="cwf-titlebar">
            <span className="cwf-title-left">Reports — General Payment Date Wise</span>
            <span className="cwf-title-right">General Payment Date Wise</span>
          </div>

          <div className="cwf-body">
            <div className="cwf-row">
              <label className="cwf-lbl">Date</label>
              <div className="cwf-field-group">
                <span className="cwf-sub-lbl">From</span>
                <input type="date" className="cwf-input" value={fromDate} onChange={e => setFromDate(e.target.value)} />
              </div>
              <div className="cwf-field-group">
                <span className="cwf-sub-lbl">To</span>
                <input type="date" className="cwf-input" value={toDate} onChange={e => setToDate(e.target.value)} />
              </div>
            </div>

            <div className="cwf-row">
              <label className="cwf-lbl">Consultant</label>
              <div className="cwf-field-group">
                <SearchableSelect
                  size="sm"
                  style={{ width: 300 }}
                  options={doctors}
                  value={doctorId}
                  onChange={v => setDoctorId(v || '')}
                  getKey={d => d.id}
                  getLabel={d => `${d.code} — ${d.name}`}
                  placeholder="— All —"
                />
              </div>
            </div>

            <div className="cwf-actions">
              <button className="cwf-btn cwf-btn--ok" onClick={handleOk}>OK</button>
              <button className="cwf-btn" onClick={() => navigate(-1)}>Close</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
