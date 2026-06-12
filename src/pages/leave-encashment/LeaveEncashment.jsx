import { useState, useEffect, useMemo, useCallback } from 'react';
import { useModuleStore } from '../../store/useModuleStore';
import { useEmployeeStore } from '../../store/useEmployeeStore';
import PageLoader from '../../components/ui/PageLoader';
import PageHeader from '../../components/shared/PageHeader';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import toast from 'react-hot-toast';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import './LeaveEncashment.scss';

function downloadFile({ filename, content, mimeType }) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function toCSV(rows = []) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v) => {
    const s = String(v ?? '');
    if (/[",\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
    return s;
  };
  return [headers.map(escape).join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))].join('\n');
}

const API = 'http://localhost:5001/api/leave-encashment';

function daysInMonth(monthKey) {
  const [year, month] = String(monthKey).split('-').map(Number);
  return new Date(year, month, 0).getDate();
}

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

const START_MONTH = '2026-06';

function getAccumulatedMonthNames() {
  const names = [];
  const [sy, sm] = START_MONTH.split('-').map(Number);
  const now = new Date();
  const ey = now.getFullYear();
  const em = now.getMonth() + 1;
  let y = sy, m = sm;
  while (y < ey || (y === ey && m <= em)) {
    names.push(new Date(y, m - 1, 1).toLocaleString('default', { month: 'long', year: 'numeric' }));
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return names;
}

function formatMonthLabel(monthKey) {
  if (!monthKey) return '';
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleString('default', { month: 'long', year: 'numeric' });
}

function round2(v) {
  return Math.round(Number(v) * 100) / 100;
}

export default function LeaveEncashment() {
  const { setModule } = useModuleStore();
  const { employees, fetchEmployees } = useEmployeeStore();

  const [loading, setLoading] = useState(true);
  const [summaryRows, setSummaryRows] = useState([]);
  const [search, setSearch] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [encashModal, setEncashModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [balance, setBalance] = useState(null);
  const [leavesCount, setLeavesCount] = useState('');
  const [encashNotes, setEncashNotes] = useState('');
  const [savingEncash, setSavingEncash] = useState(false);

  useEffect(() => {
    setModule('employee');
    fetchEmployees().then(() => setLoading(false));
  }, [setModule, fetchEmployees]);

  const fetchSummary = useCallback(async () => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (monthFilter) params.set('month', monthFilter);
    try {
      const res = await fetch(`${API}/summary?${params}`);
      const json = await res.json();
      if (json.ok && Array.isArray(json.data)) {
        setSummaryRows(json.data);
      }
    } catch {
      toast.error('Failed to load leave encashment data');
    }
  }, [search, monthFilter]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const fetchBalance = useCallback(async (employeeId) => {
    if (!employeeId) { setBalance(null); return; }
    try {
      const res = await fetch(`${API}/balance/${employeeId}`);
      const json = await res.json();
      if (json.ok) setBalance(json.data);
      else setBalance(null);
    } catch {
      setBalance(null);
    }
  }, []);

  useEffect(() => {
    fetchBalance(selectedEmployee);
  }, [selectedEmployee, fetchBalance]);

  const computedAmount = useMemo(() => {
    if (!balance || !leavesCount) return 0;
    return round2(Number(leavesCount) * balance.perDayRate);
  }, [balance, leavesCount]);

  const handleEncashSave = async () => {
    if (!selectedEmployee) { toast.error('Select an employee'); return; }
    const leaves = Number(leavesCount);
    if (!leaves || leaves <= 0) { toast.error('Enter valid leaves count'); return; }
    if (balance && leaves > balance.availableLeaves) {
      toast.error(`Only ${balance.availableLeaves} leaves available`);
      return;
    }
    setSavingEncash(true);
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: selectedEmployee, leavesCount: leaves, notes: encashNotes }),
      });
      const json = await res.json();
      if (json.ok) {
        toast.success('Leave encashment saved');
        setEncashModal(false);
        setSelectedEmployee('');
        setBalance(null);
        setLeavesCount('');
        setEncashNotes('');
        fetchSummary();
      } else {
        toast.error(json.message || 'Failed to save');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setSavingEncash(false);
    }
  };

  // Totals
  const totals = useMemo(() => {
    return summaryRows.reduce(
      (acc, r) => ({
        availableLeaves: round2(acc.availableLeaves + (r.availableLeaves || 0)),
        amount: round2(acc.amount + (r.amount || 0)),
      }),
      { availableLeaves: 0, amount: 0 }
    );
  }, [summaryRows]);

  // ─── PDF Export ────────────────────────────────────────────────────────────
  const handlePdf = (print = false) => {
    const pdf = new jsPDF('l', 'pt', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const title = monthFilter
      ? `Leave Encashment — ${formatMonthLabel(monthFilter)}`
      : 'Leave Encashment — Summary';

    pdf.setFontSize(14);
    pdf.text('Darul Shifa Imam Khomeini', pageWidth / 2, 40, { align: 'center' });
    pdf.setFontSize(11);
    pdf.text(title, 40, 80);

    const head = [['Emp Code', 'Employee Name', 'Designation', 'Department', 'Allotted', 'Total Leaves', 'Avail. Leaves', 'Months', 'Amount (PKR)']];
    const monthNamesStr = accumulatedMonthNames.join(', ');
    const body = summaryRows.map((r) => [
      r.empCode,
      r.name,
      r.designation || '—',
      r.department || '—',
      2,
      r.accumulatedLeaves,
      r.availableLeaves,
      monthNamesStr,
      r.amount.toLocaleString(),
    ]);
    body.push([
      '', 'TOTAL', '', '', '',
      summaryRows.reduce((s, r) => s + r.accumulatedLeaves, 0),
      totals.availableLeaves,
      '',
      totals.amount.toLocaleString(),
    ]);

    autoTable(pdf, {
      startY: 100,
      head,
      body,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [15, 118, 110], textColor: 255 },
      didParseCell: (data) => {
        if (data.section === 'body' && data.row.index === body.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [248, 250, 252];
        }
      },
    });

    if (print) {
      pdf.autoPrint();
      window.open(pdf.output('bloburl'), '_blank');
    } else {
      pdf.save(`leave-encashment-${monthFilter || 'summary'}.pdf`);
    }
  };

  // ─── CSV Export ────────────────────────────────────────────────────────────
  const handleExcel = () => {
    const rows = summaryRows.map((r) => ({
      'Emp Code': r.empCode,
      'Employee Name': r.name,
      Designation: r.designation || '',
      Department: r.department || '',
      'Allotted Leaves': 2,
      'Total Leaves': r.accumulatedLeaves,
      'Available Leaves': r.availableLeaves,
      Months: accumulatedMonthNames.join(', '),
      'Amount (PKR)': r.amount,
    }));
    rows.push({
      'Emp Code': '',
      'Employee Name': 'TOTAL',
      Designation: '',
      Department: '',
      'Allotted Leaves': '',
      'Total Leaves': summaryRows.reduce((s, r) => s + r.accumulatedLeaves, 0),
      'Available Leaves': totals.availableLeaves,
      Months: '',
      'Amount (PKR)': totals.amount,
    });
    downloadFile({
      filename: `leave-encashment-${monthFilter || 'summary'}.csv`,
      content: toCSV(rows),
      mimeType: 'text/csv;charset=utf-8',
    });
  };

  const accumulatedMonthNames = useMemo(() => getAccumulatedMonthNames(), []);

  // Month options: June 2026 to current
  const monthOptions = useMemo(() => {
    const opts = [];
    const start = new Date(2026, 5, 1); // June 2026
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), 1);
    let cur = new Date(start);
    while (cur <= end) {
      const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`;
      opts.push(key);
      cur.setMonth(cur.getMonth() + 1);
    }
    return opts.reverse();
  }, []);

  if (loading) return <PageLoader />;

  return (
    <div className="leave-encashment-page">
      <PageHeader
        title="Leave Encashment"
        subtitle="2 leaves per employee per month from June 2026"
        action={
          <Button label="+ New Encashment" variant="primary" onClick={() => setEncashModal(true)} />
        }
      />

      <Card>
        <div className="toolbar">
          <input
            className="search-input"
            placeholder="Search by name or code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="month-select"
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
          >
            <option value="">All Months (Summary)</option>
            {monthOptions.map((m) => (
              <option key={m} value={m}>{formatMonthLabel(m)}</option>
            ))}
          </select>
          <div className="spacer" />
          <div className="export-btns">
            <Button label="PDF" variant="secondary" onClick={() => handlePdf(false)} />
            <Button label="Print" variant="secondary" onClick={() => handlePdf(true)} />
            <Button label="CSV" variant="secondary" onClick={handleExcel} />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Emp Code</th>
                <th>Employee Name</th>
                <th>Designation</th>
                <th>Department</th>
                <th className="text-right">Allotted Leaves</th>
                <th className="text-right">Total Leaves</th>
                <th className="text-right">Avail. Leaves</th>
                <th>Months</th>
                <th className="text-right">Amount (PKR)</th>
              </tr>
            </thead>
            <tbody>
              {summaryRows.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                    No data found
                  </td>
                </tr>
              ) : (
                <>
                  {summaryRows.map((r) => (
                    <tr key={r.employeeId}>
                      <td>{r.empCode}</td>
                      <td>{r.name}</td>
                      <td>{r.designation || '—'}</td>
                      <td>{r.department || '—'}</td>
                      <td className="text-right">2</td>
                      <td className="text-right">{r.accumulatedLeaves}</td>
                      <td className="text-right">{r.availableLeaves}</td>
                      <td>
                        {accumulatedMonthNames.map((mn) => (
                          <div key={mn} style={{ fontSize: '0.8rem', lineHeight: '1.6' }}>{mn}</div>
                        ))}
                      </td>
                      <td className="text-right">{r.amount.toLocaleString()}</td>
                    </tr>
                  ))}
                  <tr className="total-row">
                    <td colSpan={4}><strong>TOTAL</strong></td>
                    <td />
                    <td className="text-right"><strong>{summaryRows.reduce((s, r) => s + r.accumulatedLeaves, 0)}</strong></td>
                    <td className="text-right"><strong>{totals.availableLeaves}</strong></td>
                    <td />
                    <td className="text-right"><strong>{totals.amount.toLocaleString()}</strong></td>

                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Encash Modal */}
      <Modal
        isOpen={encashModal}
        title="New Leave Encashment"
        onClose={() => {
          setEncashModal(false);
          setSelectedEmployee('');
          setBalance(null);
          setLeavesCount('');
          setEncashNotes('');
        }}
      >
        <div className="modal-body">
          <div className="form-group">
            <label>Employee</label>
            <select
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
            >
              <option value="">— Select Employee —</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.empCode} — {e.firstName} {e.lastName}
                </option>
              ))}
            </select>
          </div>

          {balance && (
            <div className="balance-info">
              <div className="bal-item">
                <div className="bal-label">Accumulated</div>
                <div className="bal-value">{balance.accumulatedLeaves}</div>
              </div>
              <div className="bal-item">
                <div className="bal-label">Used</div>
                <div className="bal-value" style={{ color: '#dc2626' }}>{balance.usedLeaves}</div>
              </div>
              <div className="bal-item">
                <div className="bal-label">Available</div>
                <div className="bal-value">{balance.availableLeaves}</div>
              </div>
            </div>
          )}

          {balance && (
            <>
              <div className="form-group">
                <label>Number of Leaves to Encash (max: {balance.availableLeaves})</label>
                <input
                  type="number"
                  min="1"
                  max={balance.availableLeaves}
                  step="1"
                  value={leavesCount}
                  onChange={(e) => setLeavesCount(e.target.value)}
                  placeholder="e.g. 2"
                />
              </div>

              {leavesCount && Number(leavesCount) > 0 && (
                <div className="amount-preview">
                  <div style={{ color: '#475569', marginBottom: '4px', fontSize: '0.8rem' }}>
                    {balance.name} — Basic: PKR {balance.basicSalary.toLocaleString()} ÷ {balance.daysInCurrentMonth} days × {leavesCount} leaves
                  </div>
                  Amount: <strong>PKR {computedAmount.toLocaleString()}</strong>
                </div>
              )}

              <div className="form-group">
                <label>Notes (optional)</label>
                <input
                  type="text"
                  value={encashNotes}
                  onChange={(e) => setEncashNotes(e.target.value)}
                  placeholder="Optional remarks"
                />
              </div>
            </>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <Button
              label="Cancel"
              variant="secondary"
              onClick={() => {
                setEncashModal(false);
                setSelectedEmployee('');
                setBalance(null);
                setLeavesCount('');
                setEncashNotes('');
              }}
            />
            <Button
              label={savingEncash ? 'Saving...' : 'Save'}
              variant="primary"
              onClick={handleEncashSave}
              disabled={savingEncash}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
