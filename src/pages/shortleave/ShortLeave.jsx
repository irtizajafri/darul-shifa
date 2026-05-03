import { useState, useEffect, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useModuleStore } from '../../store/useModuleStore';
import { useEmployeeStore } from '../../store/useEmployeeStore';
import PageLoader from '../../components/ui/PageLoader';
import PageHeader from '../../components/shared/PageHeader';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import Badge from '../../components/ui/Badge';
import toast from 'react-hot-toast';
import './ShortLeave.scss';

export default function ShortLeave() {
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [records, setRecords] = useState([]);
  const [employeeQuery, setEmployeeQuery] = useState('');
  const [employeeDropdownOpen, setEmployeeDropdownOpen] = useState(false);
  const { setModule } = useModuleStore();
  const { employees, fetchEmployees } = useEmployeeStore();
  const employeeDropdownRef = useRef(null);

  const { register, handleSubmit, watch, reset, setValue } = useForm();
  const empCode = watch('empCode');
  const selectedEmployee = employees.find((e) => String(e.empCode) === String(empCode));
  const filteredEmployees = useMemo(() => {
    const q = String(employeeQuery || '').trim().toLowerCase();
    if (!q) return employees || [];
    return (employees || []).filter((e) => {
      const code = String(e.empCode || '').toLowerCase();
      const fullName = `${e.firstName || ''} ${e.lastName || ''}`.trim().toLowerCase();
      return code.includes(q) || fullName.includes(q);
    });
  }, [employees, employeeQuery]);

  const STORAGE_KEY = 'shortLeaveRecords';
  const loadRecords = () => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
      return [];
    }
  };
  const saveRecords = (next) => {
    setRecords(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  useEffect(() => {
    setModule('employee');
    Promise.all([fetchEmployees()]).then(() => {
      setRecords(loadRecords());
      setLoading(false);
    });
  }, [setModule, fetchEmployees]);

  useEffect(() => {
    const onClickOutside = (event) => {
      if (!employeeDropdownRef.current) return;
      if (!employeeDropdownRef.current.contains(event.target)) {
        setEmployeeDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const findEmployeeByExactQuery = (queryText) => {
    const q = String(queryText || '').trim().toLowerCase();
    if (!q) return null;
    return (employees || []).find((e) => {
      const code = String(e.empCode || '').trim().toLowerCase();
      const fullName = `${e.firstName || ''} ${e.lastName || ''}`.trim().toLowerCase();
      return q === code || q === fullName;
    }) || null;
  };

  const selectEmployee = (employee) => {
    if (!employee) return;
    const code = String(employee.empCode || '').trim();
    const fullName = `${employee.firstName || ''} ${employee.lastName || ''}`.trim();
    setValue('empCode', code, { shouldValidate: true, shouldDirty: true });
    setEmployeeQuery(`${fullName} (${code})`);
    setEmployeeDropdownOpen(false);
  };

  const handleEmployeeInputBlur = () => {
    if (selectedEmployee) return;
    const exact = findEmployeeByExactQuery(employeeQuery);
    if (!exact) return;
    const code = String(exact.empCode || '').trim();
    const fullName = `${exact.firstName || ''} ${exact.lastName || ''}`.trim();
    setValue('empCode', code, { shouldValidate: true, shouldDirty: true });
    setEmployeeQuery(`${fullName} (${code})`);
    setEmployeeDropdownOpen(false);
  };

  const onSave = (data) => {
    if (!selectedEmployee) {
      toast.error('Employee not found');
      return;
    }
    const next = [
      {
        id: Date.now(),
        empCode: selectedEmployee.empCode,
        name: `${selectedEmployee.firstName} ${selectedEmployee.lastName}`.trim(),
        date: data.date,
        timeOut: data.timeOut,
        timeIn: data.timeIn,
        purpose: data.purpose,
        permissionBy: data.permissionBy,
        status: 'Approved'
      },
      ...records
    ];
    saveRecords(next);
    toast.success('Short leave recorded');
    setModalOpen(false);
    reset();
  };

  if (loading) return <PageLoader />;

  return (
    <div className="shortleave-page">
      <PageHeader
        breadcrumbs={[
          { link: '/employee-module', label: 'Dashboard' },
          { label: 'Short Leave' },
        ]}
        title="Short Leave"
        actionLabel="+ New Short Leave"
        onAction={() => {
          reset({});
          setEmployeeQuery('');
          setEmployeeDropdownOpen(false);
          setModalOpen(true);
        }}
      />
      <Card>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Sr</th>
                <th>Code</th>
                <th>Name</th>
                <th>Date</th>
                <th>Out</th>
                <th>In</th>
                <th>Purpose</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {records.map((s, i) => (
                <tr key={s.id}>
                  <td>{i + 1}</td>
                  <td>{s.empCode}</td>
                  <td>{s.name}</td>
                  <td>{s.date}</td>
                  <td>{s.timeOut}</td>
                  <td>{s.timeIn}</td>
                  <td>{s.purpose}</td>
                  <td>
                    <Badge label={s.status} variant={s.status === 'Approved' ? 'success' : 'warning'} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="New Short Leave"
        size="md"
      >
        <form onSubmit={handleSubmit(onSave)}>
          <div className="form-group">
            <label>Employee (Code or Name)</label>
            <div className="employee-picker" ref={employeeDropdownRef}>
              <input
                type="text"
                className="form-input"
                placeholder="Type employee code or name"
                value={employeeQuery}
                onChange={(e) => {
                  setEmployeeQuery(e.target.value);
                  setEmployeeDropdownOpen(true);
                  setValue('empCode', '', { shouldValidate: true, shouldDirty: true });
                }}
                onFocus={() => setEmployeeDropdownOpen(true)}
                onBlur={handleEmployeeInputBlur}
              />
              <input type="hidden" {...register('empCode', { required: true })} />
              {employeeDropdownOpen && (
                <div className="employee-dropdown">
                  {filteredEmployees.length === 0 ? (
                    <div className="employee-empty">No employee found</div>
                  ) : (
                    filteredEmployees.map((employee) => (
                      <button
                        key={employee.id}
                        type="button"
                        className="employee-option"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => selectEmployee(employee)}
                      >
                        <span>{employee.firstName} {employee.lastName}</span>
                        <small>{employee.empCode}</small>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="form-group mt-4">
            <label>Name (auto-fill)</label>
            <input
              type="text"
              className="form-input"
              readOnly
              value={selectedEmployee ? `${selectedEmployee.firstName} ${selectedEmployee.lastName}` : ''}
            />
          </div>
          <Input label="Permission By" {...register('permissionBy', { required: true })} />
          <div className="form-row">
            <Input label="Date" type="date" {...register('date', { required: true })} />
            <Input label="Time Out" type="time" {...register('timeOut', { required: true })} />
            <Input label="Time In" type="time" {...register('timeIn')} />
          </div>
          <div className="form-group">
            <label>Purpose *</label>
            <textarea {...register('purpose', { required: true })} className="form-textarea" rows={3} />
          </div>
          <div className="modal-actions">
            <Button type="button" label="Close" variant="ghost" onClick={() => setModalOpen(false)} />
            <Button type="button" label="Print" variant="outline" />
            <Button type="submit" label="Save" />
          </div>
        </form>
      </Modal>
    </div>
  );
}
