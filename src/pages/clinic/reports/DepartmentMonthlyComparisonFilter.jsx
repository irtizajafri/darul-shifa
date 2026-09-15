import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import ClinicMenuBar from '../../../components/clinic/ClinicMenuBar';
import './ConsultantWiseFilter.scss';
import './DepartmentMonthlyComparisonFilter.scss';

const API = 'http://localhost:5001/api/clinic';

const thisMonthStr = () => new Date().toISOString().slice(0, 7); // YYYY-MM

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthLabel = (ym) => {
  const [y, m] = ym.split('-').map(Number);
  return `${MONTH_SHORT[m - 1]}, ${y}`;
};

export default function DepartmentMonthlyComparisonFilter() {
  const navigate = useNavigate();

  const [departments, setDepartments] = useState([]);
  const [deptFrom, setDeptFrom] = useState('');
  const [deptTo, setDeptTo] = useState('');

  const [monthPicker, setMonthPicker] = useState(thisMonthStr());
  const [months, setMonths] = useState([]); // list of 'YYYY-MM', accumulated via >>

  useEffect(() => {
    fetch(`${API}/departments`)
      .then(r => r.json())
      .then(j => {
        const list = j.data || [];
        setDepartments(list);
        if (list.length) { setDeptFrom(String(list[0].id)); setDeptTo(String(list[0].id)); }
      })
      .catch(() => {});
  }, []);

  const addMonth = () => {
    if (!monthPicker) return;
    setMonths(prev => (prev.includes(monthPicker) ? prev : [...prev, monthPicker].sort()));
  };
  const removeMonth = (ym) => setMonths(prev => prev.filter(m => m !== ym));

  const handlePreview = () => {
    if (!months.length) { toast.error('Kam az kam ek Month add karein (>> button se)'); return; }
    const fromDept = departments.find(d => String(d.id) === deptFrom);
    const toDept = departments.find(d => String(d.id) === deptTo);
    const params = new URLSearchParams({
      deptFromCode: fromDept?.code || '',
      deptToCode: toDept?.code || '',
      months: months.join(','),
    });
    navigate(`/clinic/reports/department-monthly-comparison/view?${params}`);
  };

  return (
    <div className="cwf-page">
      <ClinicMenuBar />

      <div className="cwf-center">
        <div className="cwf-window dmc-window">
          <div className="cwf-titlebar">
            <span className="cwf-title-left">Reports — Department wise Monthly Comparison</span>
            <span className="cwf-title-right">Department wise Monthly Comparison</span>
          </div>

          <div className="cwf-body">

            <div className="dmc-fromto-labels">
              <span className="dmc-fromto-lbl">From</span>
              <span className="dmc-fromto-lbl">To</span>
            </div>

            <div className="cwf-row">
              <label className="cwf-lbl">Department</label>
              <select className="cwf-input dmc-half" value={deptFrom} onChange={e => setDeptFrom(e.target.value)}>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <select className="cwf-input dmc-half" value={deptTo} onChange={e => setDeptTo(e.target.value)}>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>

            <div className="dmc-month-row">
              <label className="cwf-lbl">Month</label>
              <input type="month" className="cwf-input dmc-month-input" value={monthPicker} onChange={e => setMonthPicker(e.target.value)} />
              <button type="button" className="cwf-btn dmc-add-btn" onClick={addMonth}>&gt;&gt;</button>
              <div className="dmc-month-list">
                {months.map(m => (
                  <div key={m} className="dmc-month-item" onClick={() => removeMonth(m)} title="Click to remove">
                    {monthLabel(m)}
                  </div>
                ))}
                {!months.length && <div className="dmc-month-empty">Koi month add nahi hua</div>}
              </div>
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
