import { useState, useEffect } from 'react';
import { X, Building2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useClinicStore } from '../../store/useClinicStore';
import SearchableSelect from '../ui/SearchableSelect';
import '../../pages/clinic/GeneralOPD.scss';

function formatDob(val) {
  if (!val) return '';
  try { return new Date(val).toISOString().slice(0, 10); } catch { return ''; }
}

// Panel company → employee → dependent picker shared by the OPD-style slips
// (General OPD, Emergency, Ambulance). Emergency/Ambulance used to carry an
// older copy that filtered employees on a field that doesn't exist
// (panelCompanyId), so no employee ever showed.
export default function OpdPanelModal({ onSelect, onClose }) {
  const { panelCompanies, panelEmployees, fetchPanelCompanies, fetchPanelEmployees } = useClinicStore();
  const [companyId, setCompanyId] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [dependentIdx, setDependentIdx] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchPanelCompanies(), fetchPanelEmployees()])
      .finally(() => setLoading(false));
  }, [fetchPanelCompanies, fetchPanelEmployees]);

  const companyEmployees = panelEmployees.filter(
    (e) => e.companyId === Number(companyId) && e.status === 'active'
  );

  const selectedEmployee = panelEmployees.find((e) => e.id === Number(employeeId));
  const dependents = selectedEmployee?.dependents || [];

  function handleCompanyChange(cid) {
    setCompanyId(cid);
    setEmployeeId('');
    setDependentIdx('');
  }

  function handleEmployeeChange(eid) {
    setEmployeeId(eid);
    setDependentIdx('');
  }

  function handleConfirm() {
    if (!companyId) return toast.error('Select a company');
    if (!employeeId) return toast.error('Select an employee');
    const emp = selectedEmployee;
    const dep = dependentIdx !== '' ? dependents[Number(dependentIdx)] : null;
    const patientName = dep
      ? `${dep.title} ${dep.name}`
      : `${emp.title} ${emp.name}`;
    onSelect({
      panelCompanyId: Number(companyId),
      panelEmployeeId: Number(employeeId),
      panelDependentId: dep?.id || null,
      patientName,
      panelLabel: `${panelCompanies.find(c => c.id === Number(companyId))?.code} / ${emp.empCode}${dep ? ` / ${dep.code}` : ''}`,
      dob: dep ? formatDob(dep.dob) : formatDob(emp.dob),
    });
  }

  return (
    <div className="gopd-modal-overlay" onMouseDown={onClose}>
      <div className="gopd-modal gopd-modal--panel" onMouseDown={e => e.stopPropagation()}>
        <div className="gopd-modal-header">
          <div className="gopd-modal-title"><Building2 size={16} /> Select Panel</div>
          <button className="gopd-modal-close" onClick={onClose}><X size={16} /></button>
        </div>

        {loading ? (
          <div className="gopd-modal-empty" style={{ padding: '2rem' }}>Loading...</div>
        ) : (
          <div className="gopd-panel-modal-body">
            {/* Company */}
            <div className="gopd-panel-field">
              <label className="gopd-panel-label">Company</label>
              <SearchableSelect
                options={panelCompanies.filter(c => c.status === 'active')}
                value={companyId}
                onChange={handleCompanyChange}
                getKey={c => c.id}
                getLabel={c => `${c.code} — ${c.name}`}
                placeholder="Select Company"
              />
            </div>

            {/* Employee */}
            <div className="gopd-panel-field">
              <label className="gopd-panel-label">Employee</label>
              <SearchableSelect
                options={companyEmployees}
                value={employeeId}
                onChange={handleEmployeeChange}
                getKey={e => e.id}
                getLabel={e => `${e.empCode} — ${e.title} ${e.name}`}
                placeholder="Select Employee"
                disabled={!companyId}
              />
              {companyId && companyEmployees.length === 0 && (
                <span className="gopd-panel-hint">No active employees for this company</span>
              )}
            </div>

            {/* Dependents (if any) */}
            {selectedEmployee && dependents.length > 0 && (
              <div className="gopd-panel-field">
                <label className="gopd-panel-label">Dependent (optional)</label>
                <select
                  className="gopd-panel-select"
                  value={dependentIdx}
                  onChange={e => setDependentIdx(e.target.value)}
                >
                  <option value="">— Employee (self) —</option>
                  {dependents.map((d, i) => (
                    <option key={i} value={i}>{d.code} — {d.title} {d.name} ({d.relation})</option>
                  ))}
                </select>
              </div>
            )}

            <div className="gopd-panel-actions">
              <button className="gopd-panel-cancel" onClick={onClose}>Cancel</button>
              <button className="gopd-panel-confirm" onClick={handleConfirm}>Confirm</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
