import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { DEPARTMENTS } from './departmentNames';
import { monthStr } from './reportDates';
import ClinicMenuBar from '../../../components/clinic/ClinicMenuBar';
import SearchableSelect from '../../../components/ui/SearchableSelect';
import './ConsultantWiseFilter.scss';
import './DepartmentMonthlyComparisonFilter.scss';

// Same department list as Department wise Patients (owner, 2026-10-29); the
// report counts every spelling of a department under that one name.
const DEPT_OPTIONS = DEPARTMENTS.map((name) => ({ id: name, name }));

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthLabel = (ym) => {
  const [y, m] = ym.split('-').map(Number);
  return `${MONTH_SHORT[m - 1]}, ${y}`;
};

export default function DepartmentMonthlyComparisonFilter() {
  const navigate = useNavigate();

  // Whole list by default — first to last.
  const [deptFrom, setDeptFrom] = useState(DEPARTMENTS[0]);
  const [deptTo, setDeptTo] = useState(DEPARTMENTS[DEPARTMENTS.length - 1]);

  const [monthPicker, setMonthPicker] = useState(monthStr());
  const [months, setMonths] = useState([]); // list of 'YYYY-MM', accumulated via >>

  const addMonth = () => {
    if (!monthPicker) return;
    setMonths(prev => (prev.includes(monthPicker) ? prev : [...prev, monthPicker].sort()));
  };
  const removeMonth = (ym) => setMonths(prev => prev.filter(m => m !== ym));

  const handlePreview = () => {
    if (!months.length) { toast.error('Kam az kam ek Month add karein (>> button se)'); return; }
    const params = new URLSearchParams({
      deptFrom,
      deptTo,
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
              <SearchableSelect
                size="sm"
                wrapperClassName="dmc-half"
                options={DEPT_OPTIONS}
                value={deptFrom}
                onChange={v => setDeptFrom(v)}
                getLabel={d => d.name}
                clearable={false}
              />
              <SearchableSelect
                size="sm"
                wrapperClassName="dmc-half"
                options={DEPT_OPTIONS}
                value={deptTo}
                onChange={v => setDeptTo(v)}
                getLabel={d => d.name}
                clearable={false}
              />
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
              <button className="cwf-btn cwf-btn--ok" onClick={handlePreview}>OK</button>
              <button className="cwf-btn" onClick={() => navigate(-1)}>Close</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
