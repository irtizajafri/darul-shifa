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

const toRoundedNumber = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.round(parsed);
};

const buildEqualInstallments = (totalAmount, totalMonths) => {
  const safeMonths = Math.max(0, Number(totalMonths) || 0);
  const safeAmount = Math.max(0, toRoundedNumber(totalAmount));
  if (!safeMonths || !safeAmount) return [];

  const base = Math.floor(safeAmount / safeMonths);
  let remainder = safeAmount - (base * safeMonths);

  return Array.from({ length: safeMonths }, () => {
    const bump = remainder > 0 ? 1 : 0;
    remainder = Math.max(0, remainder - bump);
    return base + bump;
  });
};

const toPositiveAmount = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return parsed;
};

const addMonthsToMonthKey = (monthKey, offset) => {
  const match = String(monthKey || '').match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!year || month < 1 || month > 12) return null;

  const shifted = new Date(year, month - 1 + offset, 1);
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, '0')}`;
};

const pickBaseInstallment = (baseSchedule = []) => {
  const positives = (baseSchedule || [])
    .map((row) => toPositiveAmount(row?.amount))
    .filter((amount) => amount > 0);

  if (!positives.length) return 0;

  const freq = new Map();
  positives.forEach((amount) => {
    const key = String(amount);
    freq.set(key, (freq.get(key) || 0) + 1);
  });

  const ranked = Array.from(freq.entries()).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return Number(b[0]) - Number(a[0]);
  });

  return Number(ranked[0]?.[0] || positives[0] || 0);
};

const buildLiveSchedule = ({ baseSchedule = [], recoveries = [], isLoan = false }) => {
  if (!Array.isArray(baseSchedule) || !baseSchedule.length) return [];

  const recoveryMap = new Map(
    (Array.isArray(recoveries) ? recoveries : []).map((row) => [
      String(row?.month || ''),
      toPositiveAmount(row?.receivedAmount ?? row?.amount),
    ])
  );

  let carryForward = 0;
  const rows = baseSchedule.map((entry) => {
    const expected = toPositiveAmount(entry?.amount);
    const receivedRaw = recoveryMap.has(entry.month) ? recoveryMap.get(entry.month) : expected;
    const received = Math.min(expected, toPositiveAmount(receivedRaw));

    if (isLoan) {
      carryForward += Math.max(0, expected - received);
    }

    return {
      month: entry.month,
      amount: received,
      expected,
      isShifted: false,
    };
  });

  if (!isLoan || carryForward <= 0) return rows;

  const lastMonth = baseSchedule[baseSchedule.length - 1]?.month;
  if (!lastMonth) return rows;

  const baseInstallment = pickBaseInstallment(baseSchedule) || 1;
  let offset = 1;
  let remaining = carryForward;

  while (remaining > 0 && offset < 240) {
    const month = addMonthsToMonthKey(lastMonth, offset);
    if (!month) break;

    const shiftedAmount = Math.min(baseInstallment, remaining);
    rows.push({
      month,
      amount: shiftedAmount,
      expected: shiftedAmount,
      isShifted: true,
    });

    remaining -= shiftedAmount;
    offset += 1;
  }

  return rows;
};

export default function AdvanceLoan() {
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [schedule, setSchedule] = useState([]);
  const [recoveries, setRecoveries] = useState([]);
  const [manualScheduleMode, setManualScheduleMode] = useState(false);
  const [apiAttendance, setApiAttendance] = useState([]);
  const { setModule } = useModuleStore();
  const { employees, fetchEmployees } = useEmployeeStore();
  const { attendanceRecords, fetchAttendance } = useAttendanceStore();
  const { records, fetchAdvanceLoans, createAdvanceLoan, updateAdvanceLoan, deleteAdvanceLoan } = useAdvanceLoanStore();

  const now = new Date();
  const defaultDate = now.toISOString().slice(0, 10);

  const { register, handleSubmit, watch, reset } = useForm({
    defaultValues: { type: 'Advance', amount: '', installmentMonths: '', issueDate: '', empCode: '', remarks: '' },
  });
  const amount = toRoundedNumber(watch('amount'));
  const months = Math.max(0, Number(watch('installmentMonths')) || 0);
  const issueDate = watch('issueDate', '');
  const recordType = watch('type', 'Advance');
  const empCode = watch('empCode');
  const selectedEmployee = employees.find((e) => String(e.empCode) === String(empCode));
  const installmentPreview = buildEqualInstallments(amount, months);
  const monthlyDed = installmentPreview[0] || 0;

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
    if (manualScheduleMode) return;
    if (!issueDate) return;

    const installmentValues = buildEqualInstallments(amount, months);
    if (!installmentValues.length) {
      setSchedule([]);
      setRecoveries([]);
      return;
    }

    const start = new Date(issueDate);
    const entries = Array.from({ length: installmentValues.length }, (_, i) => {
      const d = new Date(start.getFullYear(), start.getMonth() + i + 1, 1);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const amountValue = installmentValues[i] || 0;
      return { month: monthKey, amount: amountValue };
    });

    setSchedule(entries);
    setRecoveries((prev) => entries.map((entry) => {
      const existing = (prev || []).find((r) => r.month === entry.month);
      return {
        month: entry.month,
        receivedAmount: existing ? Number(existing.receivedAmount || 0) : Number(entry.amount || 0),
      };
    }));
  }, [issueDate, months, amount, manualScheduleMode]);

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
              actualIn: punches[0]?.timeIn ? new Date(punches[0].timeIn) : null,
              actualOut: punches[punches.length - 1]?.timeOut ? new Date(punches[punches.length - 1].timeOut) : null
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
        recoveries,
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
      setManualScheduleMode(false);
      setSchedule([]);
      setRecoveries([]);
      reset({ type: 'Advance', amount: '', installmentMonths: '', issueDate: '', empCode: '', remarks: '' });
    } catch (err) {
      toast.error(err.message || 'Failed to save record');
    }
  };

  const onEdit = (row) => {
    const normalizedType = String(row.type || 'advance').toLowerCase() === 'loan' ? 'Loan' : 'Advance';
    let issue = row?.createdAt ? new Date(row.createdAt).toISOString().slice(0, 10) : defaultDate;
    const rowBaseSchedule = Array.isArray(row.baseSchedule) && row.baseSchedule.length > 0
      ? row.baseSchedule
      : (Array.isArray(row.schedule) ? row.schedule : []);

    if (rowBaseSchedule.length > 0) {
      const [y, m] = String(rowBaseSchedule[0].month || '').split('-');
      if (y && m) {
        const firstScheduleMonth = new Date(Number(y), Number(m) - 1, 1);
        firstScheduleMonth.setMonth(firstScheduleMonth.getMonth() - 1);
        issue = `${firstScheduleMonth.getFullYear()}-${String(firstScheduleMonth.getMonth() + 1).padStart(2, '0')}-01`;
      }
    }
  const monthsCount = rowBaseSchedule.filter((s) => Number(s.amount) > 0).length || (rowBaseSchedule.length || 0);

    reset({
      empCode: row?.employee?.empCode || '',
      type: normalizedType,
      amount: Number(row.amount || 0),
      installmentMonths: monthsCount,
      issueDate: issue,
      remarks: row?.remarks || ''
    });
    const nextSchedule = rowBaseSchedule.map((s) => ({ month: s.month, amount: Number(s.amount) || 0 }));
    const recoveryMap = new Map((Array.isArray(row.recoveries) ? row.recoveries : []).map((r) => [
      String(r.month || ''),
      Number(r.receivedAmount ?? r.amount ?? 0) || 0,
    ]));

    setManualScheduleMode(true);
    setSchedule(nextSchedule);
    setRecoveries(nextSchedule.map((s) => ({
      month: s.month,
      receivedAmount: recoveryMap.has(s.month) ? recoveryMap.get(s.month) : Number(s.amount || 0),
    })));
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

  const modalTotalRecovered = recoveries.reduce((sum, r) => sum + (Number(r.receivedAmount) || 0), 0);
  const modalRemaining = Math.max(0, Number(amount || 0) - modalTotalRecovered);
  const liveSchedule = buildLiveSchedule({
    baseSchedule: schedule,
    recoveries,
    isLoan: String(recordType || '').toLowerCase() === 'loan',
  });

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
          setManualScheduleMode(false);
          setSchedule([]);
          setRecoveries([]);
          reset({ type: 'Advance', amount: '', installmentMonths: '', issueDate: '', empCode: '', remarks: '' });
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
                  <td>{a.schedule?.length || a.baseSchedule?.length || 0}</td>
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
          setManualScheduleMode(false);
          setRecoveries([]);
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
          <Input label="Installment Months" type="number" {...register('installmentMonths', { required: true, valueAsNumber: true })} />
          <div className="form-group">
            <label>Monthly Deduction (auto)</label>
            <input type="text" className="form-input" value={monthlyDed} readOnly />
          </div>
          <div className="form-group">
            <label>Earned Salary (till today)</label>
            <input type="text" className="form-input" value={earnedSalary.toLocaleString()} readOnly />
          </div>
          <div className="form-group">
            <label>Monthly Received (auto-filled, editable)</label>
            <div className="schedule-grid">
              {liveSchedule.map((s) => (
                <div key={s.month} className={`schedule-row ${s.isShifted ? 'shifted' : ''}`}>
                  <span>
                    {s.month}
                    {s.isShifted ? ' *' : ''}
                  </span>
                  <input
                    type="number"
                    value={s.amount}
                    readOnly={s.isShifted}
                    onChange={(e) => {
                      if (s.isShifted) return;
                      const nextReceived = Number(e.target.value) || 0;
                      setRecoveries((prev) => {
                        const current = Array.isArray(prev) ? prev : [];
                        const monthExists = current.some((r) => r.month === s.month);
                        if (monthExists) {
                          return current.map((r) => (
                            r.month === s.month ? { ...r, receivedAmount: nextReceived } : r
                          ));
                        }
                        return [...current, { month: s.month, receivedAmount: nextReceived }];
                      });
                    }}
                  />
                </div>
              ))}
            </div>
            {schedule.length === 0 && (
              <small style={{ color: '#666' }}>
                Amount, issue date aur installment months enter karein — schedule auto generate ho jayega.
              </small>
            )}
            {liveSchedule.some((row) => row.isShifted) && (
              <small style={{ color: '#666' }}>
                * Star wali rows shortfall se auto add hui hain (last month ke baad).
              </small>
            )}
          </div>
          <div className="form-group">
            <label>Total Paid</label>
            <input type="text" className="form-input" value={Math.round(modalTotalRecovered).toLocaleString()} readOnly />
          </div>
          <div className="form-group">
            <label>Remaining</label>
            <input type="text" className="form-input" value={Math.round(modalRemaining).toLocaleString()} readOnly />
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
