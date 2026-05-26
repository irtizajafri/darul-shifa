import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useModuleStore } from '../../store/useModuleStore';
import { useEmployeeStore } from '../../store/useEmployeeStore';
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

// ─── Pure helpers ─────────────────────────────────────────────────────────────

const toRoundedNumber = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.round(parsed);
};

const toPositiveAmount = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return parsed;
};

const addMonthsToMonthKey = (monthKey, offset) => {
  const match = String(monthKey || '').match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const year  = Number(match[1]);
  const month = Number(match[2]);
  if (!year || month < 1 || month > 12) return null;
  const shifted = new Date(year, month - 1 + offset, 1);
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, '0')}`;
};

const buildEqualInstallments = (totalAmount, totalMonths) => {
  const safeMonths = Math.max(0, Number(totalMonths) || 0);
  const safeAmount = Math.max(0, toRoundedNumber(totalAmount));
  if (!safeMonths || !safeAmount) return [];
  const base = Math.floor(safeAmount / safeMonths);
  let remainder = safeAmount - base * safeMonths;
  return Array.from({ length: safeMonths }, () => {
    const bump = remainder > 0 ? 1 : 0;
    remainder = Math.max(0, remainder - bump);
    return base + bump;
  });
};

const pickBaseInstallment = (baseSchedule = []) => {
  const positives = (baseSchedule || [])
    .map((row) => toPositiveAmount(row?.amount))
    .filter((a) => a > 0);
  if (!positives.length) return 0;
  const freq = new Map();
  positives.forEach((a) => freq.set(String(a), (freq.get(String(a)) || 0) + 1));
  const ranked = Array.from(freq.entries()).sort((a, b) =>
    b[1] !== a[1] ? b[1] - a[1] : Number(b[0]) - Number(a[0])
  );
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
    const expected    = toPositiveAmount(entry?.amount);
    const receivedRaw = recoveryMap.has(entry.month) ? recoveryMap.get(entry.month) : expected;
    const received    = Math.min(expected, toPositiveAmount(receivedRaw));
    if (isLoan) carryForward += Math.max(0, expected - received);
    return { month: entry.month, amount: received, expected, isShifted: false };
  });

  if (!isLoan || carryForward <= 0) return rows;

  const lastMonth      = baseSchedule[baseSchedule.length - 1]?.month;
  if (!lastMonth) return rows;
  const baseInstallment = pickBaseInstallment(baseSchedule) || 1;
  let offset  = 1;
  let remaining = carryForward;

  while (remaining > 0 && offset < 240) {
    const month = addMonthsToMonthKey(lastMonth, offset);
    if (!month) break;
    const shiftedAmount = Math.min(baseInstallment, remaining);
    rows.push({ month, amount: shiftedAmount, expected: shiftedAmount, isShifted: true });
    remaining -= shiftedAmount;
    offset    += 1;
  }
  return rows;
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdvanceLoan() {
  const [loading, setLoading]                     = useState(true);
  const [modalOpen, setModalOpen]                 = useState(false);
  const [editingRecord, setEditingRecord]         = useState(null);
  const [activeTab, setActiveTab]                 = useState(0);
  const [schedule, setSchedule]                   = useState([]);
  const [recoveries, setRecoveries]               = useState([]);
  const [manualScheduleMode, setManualScheduleMode] = useState(false);
  // Employee search dropdown
  const [empSearch, setEmpSearch]                 = useState('');
  const [showEmpDropdown, setShowEmpDropdown]     = useState(false);

  const { setModule }         = useModuleStore();
  const { employees, fetchEmployees } = useEmployeeStore();
  const { records, fetchAdvanceLoans, createAdvanceLoan, updateAdvanceLoan, deleteAdvanceLoan } =
    useAdvanceLoanStore();

  const now         = new Date();
  const defaultDate = now.toISOString().slice(0, 10);

  const { register, handleSubmit, watch, reset, setValue } = useForm({
    defaultValues: { type: 'Advance', amount: '', installmentMonths: '', issueDate: '', empCode: '', remarks: '' },
  });

  const amount     = toRoundedNumber(watch('amount'));
  const issueDate  = watch('issueDate', '');
  const recordType = watch('type', 'Advance');
  const empCode    = watch('empCode');
  const isAdvance  = String(recordType || '').toLowerCase() === 'advance';

  // Advance = always 1 month deduction; Loan = user-defined installment months
  const effectiveMonths = isAdvance ? 1 : Math.max(0, Number(watch('installmentMonths')) || 0);

  const selectedEmployee   = employees.find((e) => String(e.empCode) === String(empCode));
  const installmentPreview = buildEqualInstallments(amount, effectiveMonths);
  const monthlyDed         = installmentPreview[0] || 0;

  // Employee search — filter by name or code
  const filteredEmployees =
    empSearch.trim().length >= 1
      ? employees
          .filter((e) => {
            const fullName = `${e.firstName} ${e.lastName}`.toLowerCase();
            const code     = String(e.empCode).toLowerCase();
            const query    = empSearch.trim().toLowerCase();
            return fullName.includes(query) || code.includes(query);
          })
          .slice(0, 8)
      : [];

  const selectEmployee = (emp) => {
    setValue('empCode', String(emp.empCode));
    setEmpSearch(`${emp.firstName} ${emp.lastName}  (${emp.empCode})`);
    setShowEmpDropdown(false);
  };

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    setModule('employee');
    Promise.all([fetchEmployees(), fetchAdvanceLoans()]).then(() => setLoading(false));
  }, [setModule, fetchEmployees, fetchAdvanceLoans]);

  // ── Auto-generate schedule ────────────────────────────────────────────────
  useEffect(() => {
    if (manualScheduleMode) return;
    if (!issueDate) return;

    const installmentValues = buildEqualInstallments(amount, effectiveMonths);
    if (!installmentValues.length) {
      setSchedule([]);
      setRecoveries([]);
      return;
    }

    const start = new Date(issueDate);
    // Advance: same month as issue date
    // Loan:    next month after issue date
    const startOffset = isAdvance ? 0 : 1;

    const entries = Array.from({ length: installmentValues.length }, (_, i) => {
      const d        = new Date(start.getFullYear(), start.getMonth() + i + startOffset, 1);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return { month: monthKey, amount: installmentValues[i] || 0 };
    });

    setSchedule(entries);
    setRecoveries((prev) =>
      entries.map((entry) => {
        const existing = (prev || []).find((r) => r.month === entry.month);
        return {
          month:          entry.month,
          receivedAmount: existing ? Number(existing.receivedAmount || 0) : Number(entry.amount || 0),
        };
      })
    );
  }, [issueDate, effectiveMonths, amount, manualScheduleMode, isAdvance]);

  // ── Save ──────────────────────────────────────────────────────────────────
  const onSave = async (data) => {
    if (!selectedEmployee) {
      toast.error('Employee not found');
      return;
    }
    try {
      const payload = {
        employeeId: selectedEmployee.id,
        amount,
        type:      data.type.toLowerCase(),
        status:    'active',
        schedule,
        recoveries,
        remarks:   data.remarks,
      };

      if (editingRecord?.id) {
        await updateAdvanceLoan(editingRecord.id, payload);
        toast.success('Record updated');
      } else {
        await createAdvanceLoan(payload);
        toast.success('Record saved');
      }

      await fetchAdvanceLoans();
      closeModal();
    } catch (err) {
      toast.error(err.message || 'Failed to save record');
    }
  };

  // ── Edit ──────────────────────────────────────────────────────────────────
  const onEdit = (row) => {
    const normalizedType = String(row.type || 'advance').toLowerCase() === 'loan' ? 'Loan' : 'Advance';
    let issue = row?.createdAt ? new Date(row.createdAt).toISOString().slice(0, 10) : defaultDate;

    const rowBaseSchedule =
      Array.isArray(row.baseSchedule) && row.baseSchedule.length > 0
        ? row.baseSchedule
        : Array.isArray(row.schedule)
        ? row.schedule
        : [];

    if (rowBaseSchedule.length > 0) {
      const [y, m] = String(rowBaseSchedule[0].month || '').split('-');
      if (y && m) {
        if (normalizedType === 'Loan') {
          // Loan starts next month after issue — so issue = first schedule month - 1
          const firstScheduleDate = new Date(Number(y), Number(m) - 1, 1);
          firstScheduleDate.setMonth(firstScheduleDate.getMonth() - 1);
          issue = `${firstScheduleDate.getFullYear()}-${String(firstScheduleDate.getMonth() + 1).padStart(2, '0')}-01`;
        } else {
          // Advance starts same month as issue
          issue = `${y}-${m}-01`;
        }
      }
    }

    const monthsCount =
      rowBaseSchedule.filter((s) => Number(s.amount) > 0).length || rowBaseSchedule.length || 0;

    reset({
      empCode:           row?.employee?.empCode || '',
      type:              normalizedType,
      amount:            Number(row.amount || 0),
      installmentMonths: monthsCount,
      issueDate:         issue,
      remarks:           row?.remarks || '',
    });

    // Pre-fill search input with employee name
    if (row.employee) {
      setEmpSearch(`${row.employee.firstName} ${row.employee.lastName}  (${row.employee.empCode})`);
    }

    const nextSchedule = rowBaseSchedule.map((s) => ({ month: s.month, amount: Number(s.amount) || 0 }));
    const recoveryMap  = new Map(
      (Array.isArray(row.recoveries) ? row.recoveries : []).map((r) => [
        String(r.month || ''),
        Number(r.receivedAmount ?? r.amount ?? 0) || 0,
      ])
    );

    setManualScheduleMode(true);
    setSchedule(nextSchedule);
    setRecoveries(
      nextSchedule.map((s) => ({
        month:          s.month,
        receivedAmount: recoveryMap.has(s.month) ? recoveryMap.get(s.month) : Number(s.amount || 0),
      }))
    );
    setEditingRecord(row);
    setModalOpen(true);
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const onDelete = async (row) => {
    if (!window.confirm(`Delete ${row.type} record #${row.id}?`)) return;
    try {
      await deleteAdvanceLoan(row.id);
      toast.success('Record deleted');
    } catch (err) {
      toast.error(err.message || 'Failed to delete record');
    }
  };

  // ── Close modal helper ────────────────────────────────────────────────────
  const closeModal = () => {
    setModalOpen(false);
    setEditingRecord(null);
    setManualScheduleMode(false);
    setSchedule([]);
    setRecoveries([]);
    setEmpSearch('');
    reset({ type: activeTab === 0 ? 'Advance' : 'Loan', amount: '', installmentMonths: '', issueDate: '', empCode: '', remarks: '' });
  };

  // ── List helpers ──────────────────────────────────────────────────────────
  const advList  = records.filter((a) => a.type === 'advance');
  const loanList = records.filter((a) => a.type === 'loan');

  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const getMonthlyDed = (row) =>
    (row.schedule || []).find((s) => s.month === currentMonthKey)?.amount || 0;

  // Paid = sum of actual recoveries up to current month
  const getPaidTotal = (row) =>
    (row.recoveries || [])
      .filter((r) => r.month <= currentMonthKey)
      .reduce((sum, r) => sum + (Number(r.receivedAmount ?? r.amount) || 0), 0);

  // Remaining = outstanding balance (total - paid so far)
  const getRemaining = (row) => Math.max(0, Number(row.amount || 0) - getPaidTotal(row));

  // ── Modal derived values ──────────────────────────────────────────────────
  const modalTotalRecovered = recoveries.reduce((sum, r) => sum + (Number(r.receivedAmount) || 0), 0);
  const modalRemaining      = Math.max(0, Number(amount || 0) - modalTotalRecovered);
  const liveSchedule        = buildLiveSchedule({ baseSchedule: schedule, recoveries, isLoan: !isAdvance });

  // Readonly rules: once a record is saved, amount/date/months are locked
  const isPosted    = !!editingRecord?.id;
  const lockedFields = isPosted; // both advance and loan lock core fields after save

  if (loading) return <PageLoader />;

  return (
    <div className="advance-page">
      <PageHeader
        breadcrumbs={[
          { link: '/employee-module', label: 'Dashboard' },
          { label: 'Advance & Loan' },
        ]}
        title="Advance & Loan"
        actionLabel={`+ New ${activeTab === 0 ? 'Advance' : 'Loan'}`}
        onAction={() => {
          setEditingRecord(null);
          setManualScheduleMode(false);
          setSchedule([]);
          setRecoveries([]);
          setEmpSearch('');
          reset({
            type:              activeTab === 0 ? 'Advance' : 'Loan',
            amount:            '',
            installmentMonths: '',
            issueDate:         '',
            empCode:           '',
            remarks:           '',
          });
          setModalOpen(true);
        }}
      />

      {/* ── Tabs ── */}
      <div className="tabs">
        <button className={activeTab === 0 ? 'active' : ''} onClick={() => setActiveTab(0)}>
          Advances
        </button>
        <button className={activeTab === 1 ? 'active' : ''} onClick={() => setActiveTab(1)}>
          Loans
        </button>
      </div>

      {/* ── Table ── */}
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
                  <td>{Number(a.amount).toLocaleString()}</td>
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
              {(activeTab === 0 ? advList : loanList).length === 0 && (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                    No {activeTab === 0 ? 'advance' : 'loan'} records found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Modal ── */}
      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={
          editingRecord
            ? `Edit ${isAdvance ? 'Advance' : 'Loan'}`
            : `New ${activeTab === 0 ? 'Advance' : 'Loan'}`
        }
        size="md"
      >
        <form onSubmit={handleSubmit(onSave)}>
          {/* Hidden type field — controlled by tab */}
          <input type="hidden" {...register('type')} />
          {/* Hidden empCode field — controlled by dropdown */}
          <input type="hidden" {...register('empCode', { required: true })} />

          {/* ── Employee Search Dropdown ── */}
          <div className="form-group emp-search-group">
            <label>Employee <span style={{ color: '#ef4444' }}>*</span></label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className="form-input"
                placeholder="Search by name or employee code..."
                value={empSearch}
                autoComplete="off"
                onChange={(e) => {
                  setEmpSearch(e.target.value);
                  setValue('empCode', '');
                  setShowEmpDropdown(true);
                }}
                onFocus={() => setShowEmpDropdown(true)}
                onBlur={() => setTimeout(() => setShowEmpDropdown(false), 180)}
              />
              {showEmpDropdown && filteredEmployees.length > 0 && (
                <div className="emp-dropdown">
                  {filteredEmployees.map((emp) => (
                    <div
                      key={emp.id}
                      className="emp-dropdown-item"
                      onMouseDown={() => selectEmployee(emp)}
                    >
                      <span className="emp-dd-code">{emp.empCode}</span>
                      <span className="emp-dd-name">{emp.firstName} {emp.lastName}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Amount ── */}
          <div className="form-group">
            <label>Amount <span style={{ color: '#ef4444' }}>*</span></label>
            <input
              type="number"
              className="form-input"
              readOnly={lockedFields}
              style={lockedFields ? { background: '#f8fafc', color: '#64748b', cursor: 'not-allowed' } : {}}
              {...register('amount', { required: true, valueAsNumber: true })}
            />
          </div>

          {/* ── Issue Date ── */}
          <div className="form-group">
            <label>Issue Date <span style={{ color: '#ef4444' }}>*</span></label>
            <input
              type="date"
              className="form-input"
              readOnly={lockedFields}
              style={lockedFields ? { background: '#f8fafc', color: '#64748b', cursor: 'not-allowed' } : {}}
              {...register('issueDate', { required: true })}
            />
          </div>

          {/* ── Installment Months — Loan only ── */}
          {!isAdvance && (
            <div className="form-group">
              <label>Installment Months <span style={{ color: '#ef4444' }}>*</span></label>
              <input
                type="number"
                className="form-input"
                readOnly={lockedFields}
                style={lockedFields ? { background: '#f8fafc', color: '#64748b', cursor: 'not-allowed' } : {}}
                {...register('installmentMonths', { required: true, valueAsNumber: true })}
              />
            </div>
          )}

          {/* ── Monthly Deduction preview ── */}
          <div className="form-group">
            <label>{isAdvance ? 'Deduction (same month as issue)' : 'Monthly Deduction (auto)'}</label>
            <input
              type="text"
              className="form-input"
              value={isAdvance ? Number(amount || 0).toLocaleString() : monthlyDed.toLocaleString()}
              readOnly
              style={{ background: '#f8fafc', color: '#64748b' }}
            />
          </div>

          {/* ── Schedule grid ── */}
          <div className="form-group">
            <label>{isAdvance ? 'Deduction Month' : 'Monthly Recovery Schedule'}</label>
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
                    readOnly={s.isShifted || isAdvance}
                    style={(s.isShifted || isAdvance) ? { background: '#f0f0f0', cursor: 'not-allowed' } : {}}
                    onChange={(e) => {
                      if (s.isShifted || isAdvance) return;
                      const nextReceived = Number(e.target.value) || 0;
                      setRecoveries((prev) => {
                        const current    = Array.isArray(prev) ? prev : [];
                        const monthExists = current.some((r) => r.month === s.month);
                        if (monthExists) {
                          return current.map((r) =>
                            r.month === s.month ? { ...r, receivedAmount: nextReceived } : r
                          );
                        }
                        return [...current, { month: s.month, receivedAmount: nextReceived }];
                      });
                    }}
                  />
                </div>
              ))}
            </div>
            {schedule.length === 0 && (
              <small style={{ color: '#94a3b8' }}>
                {isAdvance
                  ? 'Amount aur issue date enter karein — deduction month auto set ho jayega.'
                  : 'Amount, issue date aur installment months enter karein — schedule auto generate ho jayega.'}
              </small>
            )}
            {liveSchedule.some((row) => row.isShifted) && (
              <small style={{ color: '#e67e22' }}>
                * Star wali rows carry-forward se add hui hain (last month ke baad).
              </small>
            )}
          </div>

          {/* ── Total Paid / Remaining ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label>Total Scheduled</label>
              <input
                type="text"
                className="form-input"
                value={Math.round(modalTotalRecovered).toLocaleString()}
                readOnly
                style={{ background: '#f8fafc', color: '#64748b' }}
              />
            </div>
            <div className="form-group">
              <label>Outstanding Balance</label>
              <input
                type="text"
                className="form-input"
                value={Math.round(modalRemaining).toLocaleString()}
                readOnly
                style={{
                  background:  modalRemaining > 0 ? '#fff7ed' : '#f0fdf4',
                  color:       modalRemaining > 0 ? '#c2410c' : '#15803d',
                  fontWeight:  600,
                }}
              />
            </div>
          </div>

          <Input label="Remarks" {...register('remarks')} />

          <div className="modal-actions">
            <Button type="button" label="Cancel" variant="ghost" onClick={closeModal} />
            <Button type="submit" label={editingRecord ? 'Update' : 'Save'} />
          </div>
        </form>
      </Modal>
    </div>
  );
}
