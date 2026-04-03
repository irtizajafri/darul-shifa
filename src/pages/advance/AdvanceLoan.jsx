import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { useModuleStore } from '../../store/useModuleStore';
import { useEmployeeStore } from '../../store/useEmployeeStore';
import { useAttendanceStore } from '../../store/useAttendanceStore';
import { useAdvanceLoanStore } from '../../store/useAdvanceLoanStore';
import PageLoader from '../../components/ui/PageLoader';
import PageHeader from '../../components/shared/PageHeader';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import Badge from '../../components/ui/Badge';
import toast from 'react-hot-toast';
import { formatDate } from '../../utils/helpers';
import './AdvanceLoan.scss';

export default function AdvanceLoan() {
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [schedule, setSchedule] = useState([]);
  const [apiAttendance, setApiAttendance] = useState([]);
  const { setModule } = useModuleStore();
  const { employees, fetchEmployees } = useEmployeeStore();
  const { attendanceRecords, fetchAttendance } = useAttendanceStore();
  const { records, fetchAdvanceLoans, createAdvanceLoan, updateAdvanceLoan, deleteAdvanceLoan } = useAdvanceLoanStore();

  const now = new Date();
  const defaultDate = now.toISOString().slice(0, 10);
  const { register, handleSubmit, watch, reset } = useForm({
    defaultValues: { type: 'Advance', amount: 0, installmentMonths: 12, issueDate: defaultDate },
  });
  const amount = watch('amount', 0) || 0;
  const months = watch('installmentMonths', 12) || 12;
  const issueDate = watch('issueDate', defaultDate);
  const empCode = watch('empCode');
  const selectedEmployee = employees.find((e) => String(e.empCode) === String(empCode));
  const monthlyDed = months > 0 ? Math.round(amount / months) : 0;

  const normalizeEmpCode = useCallback((value) =>
    String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, ''), []);

  const toApiDate = useCallback((dateObj) => {
    const yearStr = String(dateObj.getFullYear());
    const monthStr = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dayStr = String(dateObj.getDate()).padStart(2, '0');
    return `${yearStr}/${monthStr}/${dayStr}`;
  }, []);

  const getRosterForDate = useCallback((dateStr) => {
    if (!selectedEmployee?.dutyRoster || !Array.isArray(selectedEmployee.dutyRoster)) return null;
    const dayIndex = new Date(dateStr).getDay();
    const map = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayKey = map[dayIndex];
    return selectedEmployee.dutyRoster.find((d) => d.day === dayKey) || null;
  }, [selectedEmployee]);

  const isRosterOff = useCallback((dateStr) => {
    const roster = getRosterForDate(dateStr);
    if (!roster) return false;
    if (roster.hours !== undefined && Number(roster.hours) === 0) return true;
    if (roster.timeIn === 'OFF' || roster.timeOut === 'OFF') return true;
    return false;
  }, [getRosterForDate]);

  useEffect(() => {
    setModule('employee');
    Promise.all([fetchEmployees(), fetchAttendance(), fetchAdvanceLoans()]).then(() => setLoading(false));
  }, [setModule, fetchEmployees, fetchAttendance, fetchAdvanceLoans]);

  useEffect(() => {
    if (!issueDate) return;
    const start = new Date(issueDate);
    const entries = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const amountValue = i < months ? monthlyDed : 0;
      return { month: monthKey, amount: amountValue };
    });
    setSchedule(entries);
  }, [issueDate, months, monthlyDed]);

  useEffect(() => {
    const fetchApiAttendance = async () => {
      if (!selectedEmployee?.empCode || !issueDate) {
        setApiAttendance([]);
        return;
      }
      try {
        const issue = new Date(issueDate);
        const startDate = new Date(issue.getFullYear(), issue.getMonth(), 1);
        const endDate = new Date(issue.getFullYear(), issue.getMonth() + 1, 0);
        const res = await fetch('http://localhost:5001/api/attendance/external', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ Dates: toApiDate(startDate), DatesTo: toApiDate(endDate) })
        });
        const json = await res.json();
        if (json.status === 200 && Array.isArray(json.data)) {
          const target = normalizeEmpCode(selectedEmployee.empCode);
          const raw = json.data.filter((row) => normalizeEmpCode(row.enrollid || row.enrollId) === target);
          const byDate = raw.reduce((acc, row) => {
            const dateKey = String(row.arrive_date || row.date || '').split(' ')[0];
            if (!dateKey) return acc;
            let timeVal = String(row.arrive_time || row.time_in || '').trim();
            if (timeVal.includes(' ')) {
              timeVal = timeVal.split(' ').pop();
            }
            if (!acc[dateKey]) acc[dateKey] = [];
            if (timeVal) acc[dateKey].push(timeVal);
            return acc;
          }, {});

          const daysInMonth = endDate.getDate();
          const mapped = Array.from({ length: daysInMonth }, (_, i) => {
            const dateStr = `${issue.getFullYear()}-${String(issue.getMonth() + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
            const punches = byDate[dateStr] || [];
            const isOff = isRosterOff(dateStr);
            const isFuture = new Date(`${dateStr}T23:59:59`) > issue;
            return {
              date: new Date(dateStr),
              status: isFuture ? 'Future' : (isOff ? 'Off' : (punches.length ? 'Present' : 'Absent')),
            };
          });
          setApiAttendance(mapped);
        } else {
          setApiAttendance([]);
        }
      } catch {
        setApiAttendance([]);
      }
    };

    fetchApiAttendance();
  }, [selectedEmployee?.empCode, issueDate, normalizeEmpCode, toApiDate, isRosterOff]);

  const overrides = (() => {
    try {
      return JSON.parse(localStorage.getItem('attendanceOverrides')) || [];
    } catch {
      return [];
    }
  })();

  const earnedSalary = (() => {
    if (!selectedEmployee) return 0;
    const baseSalary = Number(selectedEmployee.basicSalary || 0);
    const allowances = selectedEmployee.allowances || [];
    const totalAllow = allowances.reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
    const monthlyTotal = baseSalary + totalAllow;
    const issue = issueDate ? new Date(issueDate) : new Date();
    const month = issue.getMonth();
    const year = issue.getFullYear();
    const recordsForMonth = attendanceRecords.filter((record) => {
      if (record.employeeId !== selectedEmployee.id) return false;
      const d = new Date(record.date);
      return d.getMonth() === month && d.getFullYear() === year;
    });
    const effectiveRecords = recordsForMonth.length ? recordsForMonth : apiAttendance;
    const attendedDays = effectiveRecords.filter((record) => {
      const d = new Date(record.date);
      if (d > issue) return false;
      const dateStr = d.toISOString().split('T')[0];
      const override = overrides.find((o) => normalizeEmpCode(o.empCode) === normalizeEmpCode(selectedEmployee.empCode) && o.date === dateStr);
      const status = (override?.status || record.status || 'present').toLowerCase();
      return status !== 'absent';
    }).length;
    const perDay = monthlyTotal / 30;
    return Math.round(perDay * attendedDays);
  })();

  const onSave = async (data) => {
    if (!selectedEmployee) {
      toast.error('Employee not found');
      return;
    }
    if (data.type === 'Advance' && amount > earnedSalary) {
      toast.error(`Advance limit exceeded. Max: ${earnedSalary.toLocaleString()}`);
      return;
    }
    try {
      const payload = {
        employeeId: selectedEmployee.id,
        amount,
        type: data.type.toLowerCase(),
        status: 'active',
        schedule,
        remarks: data.remarks
      };

      if (editingRecord?.id) {
        await updateAdvanceLoan(editingRecord.id, payload);
        toast.success('Record updated');
      } else {
        await createAdvanceLoan(payload);
        toast.success('Record saved');
      }
      await fetchAdvanceLoans();
      setModalOpen(false);
      setEditingRecord(null);
      reset({ type: 'Advance', amount: 0, installmentMonths: 12, issueDate: defaultDate, empCode: '', remarks: '' });
    } catch (err) {
      toast.error(err.message || 'Failed to save record');
    }
  };

  const onEdit = (row) => {
    const normalizedType = String(row.type || 'advance').toLowerCase() === 'loan' ? 'Loan' : 'Advance';
    let issue = row?.createdAt ? new Date(row.createdAt).toISOString().slice(0, 10) : defaultDate;
    if (Array.isArray(row.schedule) && row.schedule.length > 0) {
      const [y, m] = String(row.schedule[0].month || '').split('-');
      if (y && m) issue = `${y}-${m}-01`;
    }
    const monthsCount = (row.schedule || []).filter((s) => Number(s.amount) > 0).length || (row.schedule?.length || 12);

    reset({
      empCode: row?.employee?.empCode || '',
      type: normalizedType,
      amount: Number(row.amount || 0),
      installmentMonths: monthsCount,
      issueDate: issue,
      remarks: row?.remarks || ''
    });
    if (Array.isArray(row.schedule) && row.schedule.length > 0) {
      setSchedule(row.schedule.map((s) => ({ month: s.month, amount: Number(s.amount) || 0 })));
    }
    setEditingRecord(row);
    setModalOpen(true);
  };

  const onDelete = async (row) => {
    if (!window.confirm(`Delete ${row.type} record #${row.id}?`)) return;
    try {
      await deleteAdvanceLoan(row.id);
      toast.success('Record deleted');
    } catch (err) {
      toast.error(err.message || 'Failed to delete record');
    }
  };

  const advList = records.filter((a) => a.type === 'advance');
  const loanList = records.filter((a) => a.type === 'loan');

  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const getMonthlyDed = (row) =>
    (row.schedule || []).find((s) => s.month === currentMonthKey)?.amount || 0;
  const getPaidTotal = (row) =>
    (row.schedule || []).filter((s) => s.month < currentMonthKey).reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
  const getRemaining = (row) =>
    Number(row.amount || 0) - getPaidTotal(row);

  if (loading) return <PageLoader />;

  return (
    <div className="advance-page">
      <PageHeader
        breadcrumbs={[
          { link: '/employee-module', label: 'Dashboard' },
          { label: 'Advance & Loan' },
        ]}
        title="Advance & Loan"
        actionLabel="+ New"
        onAction={() => {
          setEditingRecord(null);
          reset({ type: 'Advance', amount: 0, installmentMonths: 12, issueDate: defaultDate, empCode: '', remarks: '' });
          setModalOpen(true);
        }}
      />
      <div className="tabs">
        <button className={activeTab === 0 ? 'active' : ''} onClick={() => setActiveTab(0)}>
          Advances
        </button>
        <button className={activeTab === 1 ? 'active' : ''} onClick={() => setActiveTab(1)}>
          Loans
        </button>
      </div>
      <Card>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Amount</th>
                <th>Date</th>
                <th>Months</th>
                <th>Monthly Ded</th>
                <th>Paid</th>
                <th>Remaining</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(activeTab === 0 ? advList : loanList).map((a) => (
                <tr key={a.id}>
                  <td>{a.employee?.empCode || '-'}</td>
                  <td>{a.employee?.firstName} {a.employee?.lastName}</td>
                  <td>{a.amount.toLocaleString()}</td>
                  <td>{formatDate(a.createdAt)}</td>
                  <td>{a.schedule?.length || 12}</td>
                  <td>{getMonthlyDed(a).toLocaleString()}</td>
                  <td>{getPaidTotal(a).toLocaleString()}</td>
                  <td>{getRemaining(a).toLocaleString()}</td>
                  <td>
                    <Badge label={a.status} variant={a.status === 'active' ? 'info' : 'success'} />
                  </td>
                  <td>
                    <button className="action-btn" onClick={() => onEdit(a)}>Edit</button>
                    <button className="action-btn" onClick={() => onDelete(a)} style={{ marginLeft: 8 }}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Modal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingRecord(null);
        }}
        title={editingRecord ? 'Edit Advance / Loan' : 'New Advance / Loan'}
        size="md"
      >
        <form onSubmit={handleSubmit(onSave)}>
          <Input label="Employee Code" placeholder="Search..." {...register('empCode', { required: true })} />
          <div className="form-group">
            <label>Name (auto-fill)</label>
            <input type="text" className="form-input" readOnly value={selectedEmployee ? `${selectedEmployee.firstName} ${selectedEmployee.lastName}` : ''} />
          </div>
          <div className="form-group">
            <label>Type</label>
            <div className="radio-group">
              <label><input type="radio" value="Advance" {...register('type')} /> Advance</label>
              <label><input type="radio" value="Loan" {...register('type')} /> Loan</label>
            </div>
          </div>
          <Input label="Amount" type="number" {...register('amount', { required: true, valueAsNumber: true })} />
          <Input label="Issue Date" type="date" {...register('issueDate', { required: true })} />
          <Input label="Installment Months" type="number" {...register('installmentMonths', { valueAsNumber: true })} />
          <div className="form-group">
            <label>Monthly Deduction (auto)</label>
            <input type="text" className="form-input" value={monthlyDed} readOnly />
          </div>
          <div className="form-group">
            <label>Earned Salary (till today)</label>
            <input type="text" className="form-input" value={earnedSalary.toLocaleString()} readOnly />
          </div>
          <div className="form-group">
            <label>Schedule (12 months)</label>
            <div className="schedule-grid">
              {schedule.map((s, idx) => (
                <div key={s.month} className="schedule-row">
                  <span>{s.month}</span>
                  <input
                    type="number"
                    value={s.amount}
                    onChange={(e) => {
                      const next = [...schedule];
                      next[idx] = { ...next[idx], amount: Number(e.target.value) || 0 };
                      setSchedule(next);
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label>Total Paid</label>
            <input type="text" className="form-input" value="0" readOnly />
          </div>
          <div className="form-group">
            <label>Remaining</label>
            <input type="text" className="form-input" value={amount} readOnly />
          </div>
          <Input label="Remarks" {...register('remarks')} />
          <div className="modal-actions">
            <Button type="button" label="Cancel" variant="ghost" onClick={() => setModalOpen(false)} />
            <Button type="submit" label={editingRecord ? 'Update' : 'Save'} />
          </div>
        </form>
      </Modal>
    </div>
  );
}
