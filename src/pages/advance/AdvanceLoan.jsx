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
    const received    = toPositiveAmount(receivedRaw);
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
  // Dashboard list search
  const [listSearch, setListSearch]               = useState('');

  const { setModule }         = useModuleStore();
  const { employees, fetchEmployees } = useEmployeeStore();
  const { records, fetchAdvanceLoans, createAdvanceLoan, updateAdvanceLoan, deleteAdvanceLoan } =
    useAdvanceLoanStore();

  const now         = new Date();
  const defaultDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

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
        issueDate: data.issueDate || null,
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
    const rowBaseSchedule =
      Array.isArray(row.baseSchedule) && row.baseSchedule.length > 0
        ? row.baseSchedule
        : Array.isArray(row.schedule)
        ? row.schedule
        : [];

    // Use saved issueDate first, then reconstruct from schedule, then fall back to today
    let issue = row.issueDate || null;
    if (!issue && rowBaseSchedule.length > 0) {
      const [y, m] = String(rowBaseSchedule[0].month || '').split('-');
      if (y && m) {
        if (normalizedType === 'Loan') {
          const firstScheduleDate = new Date(Number(y), Number(m) - 1, 1);
          firstScheduleDate.setMonth(firstScheduleDate.getMonth() - 1);
          issue = `${firstScheduleDate.getFullYear()}-${String(firstScheduleDate.getMonth() + 1).padStart(2, '0')}-01`;
        } else {
          issue = `${y}-${m}-01`;
        }
      }
    }
    if (!issue) issue = defaultDate;

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

  // ── Print ─────────────────────────────────────────────────────────────────
  const onPrint = (row) => {
    const emp       = row.employee || {};
    const empName   = `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || '-';
    const empCode   = emp.empCode || '-';
    const type      = String(row.type || '').charAt(0).toUpperCase() + String(row.type || '').slice(1);
    const amount    = Number(row.amount || 0).toLocaleString();
    const issueDateStr = row.issueDate || (row.createdAt ? new Date(row.createdAt).toISOString().slice(0, 10) : null);
    const issueDate = issueDateStr ? new Date(issueDateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
    const status    = String(row.status || '').charAt(0).toUpperCase() + String(row.status || '').slice(1);
    const remarks   = row.remarks || '-';
    const paidTotal = getPaidTotal(row);
    const remaining = getRemaining(row);
    const printedOn = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

    const baseSchedule = Array.isArray(row.baseSchedule) && row.baseSchedule.length
      ? row.baseSchedule
      : Array.isArray(row.schedule) ? row.schedule : [];

    const recoveryMap = new Map(
      (Array.isArray(row.recoveries) ? row.recoveries : []).map((r) => [
        String(r.month || ''),
        Number(r.receivedAmount ?? r.amount ?? 0),
      ])
    );

    const scheduleRows = baseSchedule.map((s) => {
      const expected = Number(s.amount || 0);
      const received = recoveryMap.has(s.month) ? recoveryMap.get(s.month) : expected;
      const diff     = expected - received;
      return `
        <tr>
          <td>${s.month}</td>
          <td>${expected.toLocaleString()}</td>
          <td>${received.toLocaleString()}</td>
          <td style="color:${diff > 0 ? '#dc2626' : '#16a34a'}">${diff > 0 ? diff.toLocaleString() : '—'}</td>
        </tr>`;
    }).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
      <title>${type} Voucher — ${empName}</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 13px; color: #1e293b; margin: 0; padding: 24px; }
        h2 { text-align: center; margin: 0 0 2px; font-size: 18px; }
        .subtitle { text-align: center; color: #64748b; font-size: 12px; margin-bottom: 16px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 24px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 18px; margin-bottom: 18px; }
        .info-row { display: flex; gap: 6px; }
        .info-label { color: #64748b; min-width: 120px; }
        .info-value { font-weight: 600; }
        .badge { display: inline-block; padding: 2px 10px; border-radius: 99px; font-size: 11px; font-weight: 700; background: ${row.status === 'active' ? '#dbeafe' : '#dcfce7'}; color: ${row.status === 'active' ? '#1d4ed8' : '#15803d'}; }
        h4 { margin: 0 0 8px; font-size: 13px; color: #475569; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th { background: #1e40af; color: #fff; padding: 7px 10px; text-align: left; }
        td { padding: 6px 10px; border-bottom: 1px solid #f1f5f9; }
        tr:nth-child(even) td { background: #f8fafc; }
        .totals { display: flex; gap: 16px; margin-top: 14px; }
        .total-box { flex: 1; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; }
        .total-box .lbl { font-size: 11px; color: #64748b; }
        .total-box .val { font-size: 15px; font-weight: 700; margin-top: 2px; }
        .footer { margin-top: 40px; display: flex; justify-content: space-between; }
        .sign-box { text-align: center; width: 160px; }
        .sign-line { border-top: 1px solid #334155; margin-bottom: 4px; }
        .sign-label { font-size: 11px; color: #64748b; }
        @media print { body { padding: 12px; } }
      </style></head><body>
      <h2>Darul Shifa Imam Khomeini</h2>
      <div class="subtitle">${type} Voucher &nbsp;|&nbsp; Printed: ${printedOn}</div>

      <div class="info-grid">
        <div class="info-row"><span class="info-label">Employee Name</span><span class="info-value">${empName}</span></div>
        <div class="info-row"><span class="info-label">Emp Code</span><span class="info-value">${empCode}</span></div>
        <div class="info-row"><span class="info-label">Type</span><span class="info-value">${type}</span></div>
        <div class="info-row"><span class="info-label">Issue Date</span><span class="info-value">${issueDate}</span></div>
        <div class="info-row"><span class="info-label">Total Amount</span><span class="info-value">PKR ${amount}</span></div>
        <div class="info-row"><span class="info-label">Status</span><span class="info-value"><span class="badge">${status}</span></span></div>
        <div class="info-row"><span class="info-label">Remarks</span><span class="info-value">${remarks}</span></div>
      </div>

      <h4>Recovery Schedule</h4>
      <table>
        <thead><tr><th>Month</th><th>Expected</th><th>Received</th><th>Pending</th></tr></thead>
        <tbody>${scheduleRows || '<tr><td colspan="4" style="color:#94a3b8;text-align:center">No schedule</td></tr>'}</tbody>
      </table>

      <div class="totals">
        <div class="total-box"><div class="lbl">Total Amount</div><div class="val" style="color:#1e40af">PKR ${amount}</div></div>
        <div class="total-box"><div class="lbl">Total Paid</div><div class="val" style="color:#16a34a">PKR ${paidTotal.toLocaleString()}</div></div>
        <div class="total-box"><div class="lbl">Outstanding Balance</div><div class="val" style="color:${remaining > 0 ? '#dc2626' : '#16a34a'}">PKR ${remaining.toLocaleString()}</div></div>
      </div>

      <div class="footer">
        <div class="sign-box"><div class="sign-line"></div><div class="sign-label">Employee</div></div>
        <div class="sign-box"><div class="sign-line"></div><div class="sign-label">Accountant</div></div>
        <div class="sign-box"><div class="sign-line"></div><div class="sign-label">Administrator</div></div>
      </div>
    </body></html>`;

    const win = window.open('', '_blank', 'width=800,height=700');
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 400);
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
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
  const filterBySearch = (list) => {
    const q = listSearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter((a) => {
      const name = `${a.employee?.firstName || ''} ${a.employee?.lastName || ''}`.toLowerCase();
      const code = String(a.employee?.empCode || '').toLowerCase();
      return name.includes(q) || code.includes(q);
    });
  };
  const advList  = filterBySearch(records.filter((a) => a.type === 'advance'));
  const loanList = filterBySearch(records.filter((a) => a.type === 'loan'));

  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const getMonthlyDed = (row) =>
    (row.schedule || []).find((s) => s.month === currentMonthKey)?.amount || 0;

  // Paid:
  //   Advance → sum of scheduled installments in strictly past months (auto-deducted from salary)
  //   Loan    → sum of explicit recovery amounts up to current month
  const getPaidTotal = (row) => {
    const type = String(row.type || '').toLowerCase();
    if (type === 'advance') {
      return Math.round(
        (row.baseSchedule || row.schedule || [])
          .filter((s) => String(s.month || '') < currentMonthKey)
          .reduce((sum, s) => sum + (Number(s.amount) || 0), 0)
      );
    }
    return Math.round(
      (row.recoveries || [])
        .filter((r) => String(r.month || '') <= currentMonthKey)
        .reduce((sum, r) => sum + (Number(r.receivedAmount ?? r.amount) || 0), 0)
    );
  };

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
            issueDate:         defaultDate,
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

      {/* ── Search Bar ── */}
      <div style={{ margin: '12px 0 8px', maxWidth: 320 }}>
        <input
          type="text"
          className="form-input"
          placeholder="Search by name or emp code..."
          value={listSearch}
          onChange={(e) => setListSearch(e.target.value)}
          style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}
        />
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
                  <td>{formatDate(a.issueDate || a.createdAt)}</td>
                  <td>{a.schedule?.length || a.baseSchedule?.length || 0}</td>
                  <td>{getMonthlyDed(a).toLocaleString()}</td>
                  <td>{getPaidTotal(a).toLocaleString()}</td>
                  <td>{getRemaining(a).toLocaleString()}</td>
                  <td>
                    <Badge label={a.status} variant={a.status === 'active' ? 'info' : 'success'} />
                  </td>
                  <td>
                    <button className="action-btn" onClick={() => onEdit(a)}>Edit</button>
                    <button className="action-btn" onClick={() => onPrint(a)} style={{ marginLeft: 8 }}>Print</button>
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
                      const nextReceived = Math.max(0, Number(e.target.value) || 0);
                      const allMonths    = schedule.map((x) => x.month);
                      const thisIdx      = allMonths.indexOf(s.month);

                      // Sum paid for months BEFORE this one
                      setRecoveries((prev) => {
                        const current = Array.isArray(prev) ? prev : [];

                        // Update this month first
                        let updated = current.some((r) => r.month === s.month)
                          ? current.map((r) => r.month === s.month ? { ...r, receivedAmount: nextReceived } : r)
                          : [...current, { month: s.month, receivedAmount: nextReceived }];

                        // Paid so far = this month + all months before it
                        const paidBefore = updated
                          .filter((r) => allMonths.indexOf(r.month) < thisIdx)
                          .reduce((sum, r) => sum + (Number(r.receivedAmount) || 0), 0);
                        const paidSoFar  = paidBefore + nextReceived;
                        const remaining  = Math.max(0, amount - paidSoFar);

                        // Redistribute remaining equally across future months
                        const futureMonths = allMonths.slice(thisIdx + 1);
                        if (futureMonths.length > 0) {
                          const base      = Math.floor(remaining / futureMonths.length);
                          let   leftover  = remaining - base * futureMonths.length;
                          updated = updated.filter((r) => !futureMonths.includes(r.month));
                          futureMonths.forEach((m) => {
                            const bump = leftover > 0 ? 1 : 0;
                            leftover   = Math.max(0, leftover - bump);
                            updated.push({ month: m, receivedAmount: base + bump });
                          });
                        }

                        return updated;
                      });

                      // Also update schedule (expected) so display stays consistent
                      setSchedule((prev) => {
                        const allM     = prev.map((x) => x.month);
                        const idx      = allM.indexOf(s.month);
                        const paidBef  = recoveries
                          .filter((r) => allM.indexOf(r.month) < idx)
                          .reduce((sum, r) => sum + (Number(r.receivedAmount) || 0), 0);
                        const remaining = Math.max(0, amount - paidBef - nextReceived);
                        const future    = allM.slice(idx + 1);
                        if (!future.length) return prev.map((x) => x.month === s.month ? { ...x, amount: nextReceived } : x);
                        const base     = Math.floor(remaining / future.length);
                        let   leftover = remaining - base * future.length;
                        return prev.map((x) => {
                          if (x.month === s.month) return { ...x, amount: nextReceived };
                          if (future.includes(x.month)) {
                            const bump = leftover > 0 ? 1 : 0;
                            leftover   = Math.max(0, leftover - bump);
                            return { ...x, amount: base + bump };
                          }
                          return x;
                        });
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
