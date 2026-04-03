import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useModuleStore } from '../../store/useModuleStore';
import { useAttendanceStore } from '../../store/useAttendanceStore';
import { useEmployeeStore } from '../../store/useEmployeeStore';
import PageLoader from '../../components/ui/PageLoader';
import PageHeader from '../../components/shared/PageHeader';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import Badge from '../../components/ui/Badge';
import toast from 'react-hot-toast';
import { Download } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import logo from '../../assets/logo.jpg';
import { format } from 'date-fns';
import './AttendanceList.scss';

export default function AttendanceList() {
  const today = new Date();
  const defaultApiDate = today.toISOString().slice(0, 10);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [editModal, setEditModal] = useState(null);
  const [addModal, setAddModal] = useState(false);
  const [overrides, setOverrides] = useState([]);
  const [apiDateUi, setApiDateUi] = useState(defaultApiDate);
  const [selectedDate, setSelectedDate] = useState(defaultApiDate);
  const [apiStaffId, setApiStaffId] = useState('');
  const [apiRows, setApiRows] = useState([]);
  const [apiLoading, setApiLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [searchName, setSearchName] = useState('');
  const { setModule } = useModuleStore();
  const { attendanceRecords, fetchAttendance } = useAttendanceStore();
  const { employees, fetchEmployees } = useEmployeeStore();

  const { register, handleSubmit, reset } = useForm();

  const OVERRIDE_KEY = 'attendanceOverrides';
  const loadOverrides = () => {
    try {
      return JSON.parse(localStorage.getItem(OVERRIDE_KEY)) || [];
    } catch {
      return [];
    }
  };
  const saveOverrides = (next) => {
    setOverrides(next);
    localStorage.setItem(OVERRIDE_KEY, JSON.stringify(next));
  };

  const toInputTimeValue = (value) => {
    if (!value || value === '-') return '';
    const raw = String(value).trim();

    // Already HH:mm or HH:mm:ss
    if (/^\d{2}:\d{2}(:\d{2})?$/.test(raw)) return raw.slice(0, 5);

    // DateTime string: 2026-03-01T08:30:00 or 2026-03-01 08:30:00
    const timePart = raw.includes('T')
      ? raw.split('T')[1]
      : (raw.includes(' ') ? raw.split(' ').pop() : raw);
    if (/^\d{2}:\d{2}(:\d{2})?$/.test(timePart)) return timePart.slice(0, 5);

    // 12-hour value like 08:30 AM
    const match = raw.match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/);
    if (match) {
      let hh = Number(match[1]);
      const mm = match[2];
      const ampm = match[3].toUpperCase();
      if (ampm === 'PM' && hh < 12) hh += 12;
      if (ampm === 'AM' && hh === 12) hh = 0;
      return `${String(hh).padStart(2, '0')}:${mm}`;
    }

    return '';
  };

  useEffect(() => {
    setModule('employee');
    fetchEmployees();
    fetchAttendance().then(() => setLoading(false));
    setOverrides(loadOverrides());
  }, [setModule]);

  useEffect(() => {
    if (!editModal) return;
    reset({
      employee: employees.find((e) => String(e.empCode) === String(editModal.empCode))?.id || '',
      dateIn: editModal.date || '',
      dateOut: editModal.date || '',
      timeIn: toInputTimeValue(editModal.timeIn),
      timeOut: toInputTimeValue(editModal.timeOut),
      status: editModal.status || 'present'
    });
  }, [editModal, employees, reset]);

  const exportMeta = {
    address: 'C 1-4 Survery # 675 Jaffar e Tayyar Society Malir, Karachi, Pakistan, 75210',
    phone: '021-34508390',
    whatsapp: '+92 334 2225746'
  };

  const toCSV = (rows = []) => {
    if (!rows.length) return '';
    const headers = Object.keys(rows[0]);
    const escape = (v) => {
      const s = String(v ?? '');
      if (/[",\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
      return s;
    };
    const lines = [
      headers.map(escape).join(','),
      ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))
    ];
    return lines.join('\n');
  };

  const downloadFile = ({ filename, content, mimeType }) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const buildExportRows = () => (
    filteredApiRows.map((row) => {
      const enrollId = String(row.enrollid || row.enrollId || '').trim();
      const match = employees.find((e) => String(e.empCode) === enrollId);
      return {
        code: enrollId || '-',
        name: match ? `${match.firstName} ${match.lastName}` : '-',
        date: row.arrive_date || row.date || '-',
        timeIn: row.arrive_time || row.time_in || '-',
        timeOut: row.depart_time || row.time_out || '-',
        status: 'Present'
      };
    })
  );

  const handleExportExcel = () => {
    const rows = buildExportRows();
    if (!rows.length) {
      toast.error('No attendance records to export');
      return;
    }
    const dateTag = apiDateUi || 'attendance';
    downloadFile({
      filename: `attendance-${dateTag}.csv`,
      content: toCSV(rows),
      mimeType: 'text/csv;charset=utf-8'
    });
    toast.success('Excel (CSV) exported');
  };

  const handleExportPdf = async () => {
    const rows = buildExportRows();
    if (!rows.length) {
      toast.error('No attendance records to export');
      return;
    }

    const pdf = new jsPDF('p', 'pt', 'a4');
    const img = new Image();
    img.src = logo;

    await new Promise((resolve) => {
      img.onload = resolve;
      img.onerror = resolve;
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const margin = 40;

    if (img.complete && img.naturalWidth) {
      pdf.addImage(img, 'JPEG', margin, 20, 60, 60);
    }

    pdf.setFontSize(14);
    pdf.text('Darul Shifa Imam Khomeini', margin + 80, 40);
    pdf.setFontSize(9);
    pdf.text(exportMeta.address, margin + 80, 58, { maxWidth: pageWidth - margin * 2 - 80 });
    pdf.text(`Tel: ${exportMeta.phone}`, margin + 80, 74);
    pdf.text(`WhatsApp: ${exportMeta.whatsapp}`, margin + 80, 90);
    pdf.setFontSize(10);
    pdf.text(`Attendance Report: ${apiDateUi || ''}`, margin, 120);

    autoTable(pdf, {
      startY: 140,
      head: [['Code', 'Name', 'Date', 'Time In', 'Time Out', 'Status']],
      body: rows.map((r) => [r.code, r.name, r.date, r.timeIn, r.timeOut, r.status]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [37, 99, 235] }
    });

    const footerY = pdf.internal.pageSize.getHeight() - 40;
    pdf.setFontSize(8);
    pdf.text(exportMeta.address, margin, footerY, { maxWidth: pageWidth - margin * 2 });
    pdf.text(`Tel: ${exportMeta.phone} | WhatsApp: ${exportMeta.whatsapp}`, margin, footerY + 12);

    pdf.save(`attendance-${apiDateUi || 'report'}.pdf`);
    toast.success('PDF exported');
  };

  const toApiDate = (dateValue) => {
    if (!dateValue) return '';
    const [year, month, day] = dateValue.split('-');
    return `${year}/${month}/${day}`;
  };

  const handleApiFetch = async (dateValue) => {
    if (!dateValue) {
      setApiRows([]);
      return;
    }
    setApiLoading(true);
    setApiError('');
    const apiDate = toApiDate(dateValue);
    try {
      const res = await fetch('http://localhost:5001/api/attendance/external', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Dates: apiDate, DatesTo: apiDate })
      });
      const json = await res.json();
      if (json.status === 200 && Array.isArray(json.data)) {
        setApiRows(json.data);
      } else {
        setApiRows([]);
        setApiError(json.message || 'No data found');
      }
    } catch (err) {
      setApiError(`API error: ${err.message}`);
    } finally {
      setApiLoading(false);
    }
  };

  useEffect(() => {
    handleApiFetch(apiDateUi);
  }, [apiDateUi]);

  const normalizedStaffId = apiStaffId.trim();
  const filteredApiRows = normalizedStaffId
    ? apiRows.filter((row) => String(row.enrollid || row.enrollId || '').trim() === normalizedStaffId)
    : apiRows;

  const upsertOverride = (payload) => {
    const dateValue = payload.date || payload.dateIn || payload.dateOut;
    if (!payload.empCode || !dateValue) return;
    const next = overrides.filter((o) => !(String(o.empCode) === String(payload.empCode) && o.date === dateValue));
    next.unshift({
      id: payload.id || Date.now(),
      empCode: payload.empCode,
      date: dateValue,
      timeIn: payload.timeIn || '',
      timeOut: payload.timeOut || '',
      status: payload.status || 'present'
    });
    saveOverrides(next);
  };

  const onEditSave = (data) => {
    const emp = employees.find((e) => String(e.id) === String(data.employee));
    if (!emp) {
      toast.error('Employee not found');
      return;
    }
    upsertOverride({
      empCode: emp.empCode,
      date: data.dateIn || data.dateOut,
      timeIn: data.timeIn || toInputTimeValue(editModal?.timeIn),
      timeOut: data.timeOut || toInputTimeValue(editModal?.timeOut),
      status: data.status
    });
    toast.success('Attendance updated');
    setEditModal(null);
    reset();
  };

  const onAddSave = (data) => {
    const emp = employees.find((e) => String(e.id) === String(data.employee));
    if (!emp) {
      toast.error('Employee not found');
      return;
    }
    upsertOverride({
      empCode: emp.empCode,
      date: data.dateIn || data.dateOut,
      timeIn: data.timeIn,
      timeOut: data.timeOut,
      status: data.status
    });
    toast.success('Manual entry added');
    setAddModal(false);
    reset();
  };

  const getOverride = (empCode, date) => overrides.find((o) => String(o.empCode) === String(empCode) && o.date === date);
  const apiTimesByEmp = useMemo(() => {
    const map = {};
    apiRows.forEach((row) => {
      const enrollId = String(row.enrollid || row.enrollId || '').trim();
      if (!enrollId) return;
      const dateKey = String(row.arrive_date || row.date || '').split(' ')[0];
      if (selectedDate && dateKey && dateKey !== selectedDate) return;
      let timeVal = String(row.arrive_time || row.time_in || '').trim();
      if (timeVal.includes(' ')) {
        timeVal = timeVal.split(' ').pop();
      }
      if (!timeVal) return;
      if (!map[enrollId]) map[enrollId] = [];
      map[enrollId].push(timeVal);
    });
    return Object.entries(map).reduce((acc, [empCode, times]) => {
      const sorted = times.slice().sort();
      acc[empCode] = {
        timeIn: sorted[0] || '',
        timeOut: sorted.length > 1 ? sorted[sorted.length - 1] : ''
      };
      return acc;
    }, {});
  }, [apiRows, selectedDate]);

  const getApiTimes = (empCode) => {
    const raw = apiTimesByEmp[empCode];
    if (!raw) return { timeIn: '', timeOut: '', hasData: false };
    const toDisplay = (value) => {
      if (!value || !selectedDate) return '';
      const dt = new Date(`${selectedDate}T${value}`);
      if (Number.isNaN(dt.getTime())) return value;
      return format(dt, 'hh:mm a');
    };
    return {
      timeIn: toDisplay(raw.timeIn),
      timeOut: toDisplay(raw.timeOut),
      hasData: Boolean(raw.timeIn || raw.timeOut)
    };
  };
  const combinedRecords = (() => {
    const attendanceByEmpDate = attendanceRecords.reduce((acc, record) => {
      const dateValue = record.date ? format(new Date(record.date), 'yyyy-MM-dd') : '';
      if (!record.employee?.empCode || !dateValue) return acc;
      const key = `${record.employee.empCode}-${dateValue}`;
      acc[key] = record;
      return acc;
    }, {});

    const base = employees.map((emp) => {
      const dateValue = selectedDate || '';
      const key = `${emp.empCode}-${dateValue}`;
      const record = attendanceByEmpDate[key];
      const override = getOverride(emp.empCode, dateValue);
      const apiTimes = getApiTimes(emp.empCode);

      return {
        key: `row-${emp.empCode}-${dateValue}`,
        empCode: emp.empCode,
        name: `${emp.firstName || ''} ${emp.lastName || ''}`.trim(),
        date: dateValue,
        timeIn: override?.timeIn || (record?.actualIn ? format(new Date(record.actualIn), 'hh:mm a') : (apiTimes.timeIn || '-')),
        timeOut: override?.timeOut || (record?.actualOut ? format(new Date(record.actualOut), 'hh:mm a') : (apiTimes.timeOut || '-')),
        status: override?.status || record?.status || (apiTimes.hasData ? 'present' : 'absent')
      };
    });

    const extra = overrides.filter((o) => !employees.some((emp) => emp.empCode === o.empCode)).map((o) => {
      const emp = employees.find((e) => e.empCode === o.empCode);
      return {
        key: `override-${o.id}`,
        empCode: o.empCode,
        name: emp ? `${emp.firstName} ${emp.lastName}` : '-',
        date: o.date,
        timeIn: o.timeIn || '-',
        timeOut: o.timeOut || '-',
        status: o.status || 'present'
      };
    });

    return [...extra, ...base];
  })();

  const dateOptions = useMemo(() => {
    if (!selectedDate) return [];
    const base = new Date(selectedDate);
    const year = base.getFullYear();
    const month = base.getMonth();
    const days = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: days }, (_, i) => {
      const d = new Date(year, month, i + 1);
      return d.toISOString().slice(0, 10);
    });
  }, [selectedDate]);

  const filteredRecords = useMemo(() => {
    let result = combinedRecords;
    if (selectedDate) {
      result = result.filter((row) => row.date === selectedDate);
    }
    if (searchName) {
      const q = searchName.toLowerCase();
      result = result.filter(
        (row) =>
          (row.name || '').toLowerCase().includes(q) ||
          String(row.empCode || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [combinedRecords, selectedDate, searchName]);

  if (loading) return <PageLoader />;

  return (
    <div className="attendance-page">
      <PageHeader
        breadcrumbs={[
          { link: '/employee-module', label: 'Dashboard' },
          { label: 'Attendance' },
        ]}
        title="Attendance"
      />
      <div className="tabs">
        <button className={activeTab === 0 ? 'active' : ''} onClick={() => setActiveTab(0)}>
          Daily View
        </button>
        <button className={activeTab === 1 ? 'active' : ''} onClick={() => setActiveTab(1)}>
          All Records
        </button>
      </div>

      {activeTab === 0 && (
        <Card>
          <div className="info-banner blue flex justify-between items-center" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <p>Daily attendance records (live API)</p>
          </div>
          <div className="filters-row mt-4">
            <input
              type="date"
              className="filter-input"
              value={apiDateUi}
              onChange={(e) => setApiDateUi(e.target.value)}
            />
            <input
              type="text"
              placeholder="Staff ID"
              className="filter-input"
              value={apiStaffId}
              onChange={(e) => setApiStaffId(e.target.value)}
            />
            <Button label="Excel" icon={Download} variant="outline" onClick={handleExportExcel} />
            <Button label="PDF" icon={Download} variant="primary" onClick={handleExportPdf} />
          </div>
          {apiError && <p className="text-red-500 mt-3">{apiError}</p>}
          <div className="overflow-x-auto mt-4">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Date</th>
                  <th>In</th>
                  <th>Out</th>
                  <th>Late (Min)</th>
                  <th>OT (Min)</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {apiLoading ? (
                  <tr><td colSpan="8" className="text-center py-4">Loading...</td></tr>
                ) : filteredApiRows.length === 0 ? (
                  <tr><td colSpan="8" className="text-center py-4">No attendance records found.</td></tr>
                ) : (
                  filteredApiRows.map((row, idx) => {
                    const enrollId = String(row.enrollid || row.enrollId || '');
                    const match = employees.find((e) => String(e.empCode) === enrollId);
                    return (
                      <tr key={`api-row-${idx}`}>
                        <td>{enrollId || '-'}</td>
                        <td>{match ? `${match.firstName} ${match.lastName}` : '-'}</td>
                        <td>{row.arrive_date || row.date || '-'}</td>
                        <td>{row.arrive_time || row.time_in || '-'}</td>
                        <td>{row.depart_time || row.time_out || '-'}</td>
                        <td>-</td>
                        <td>-</td>
                        <td>
                          <Badge label="Present" variant="success" />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {activeTab === 1 && (
        <Card>
          <div className="info-banner amber">
            <p>Editable attendance and manual entries (salary will use edited rows)</p>
          </div>
          <div className="filters-row">
            <input
              type="date"
              className="filter-input"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setApiDateUi(e.target.value);
              }}
            />
            <input
              type="text"
              placeholder="Search by name or code..."
              className="filter-input"
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
            />
            <Button label="+ Add Manual Entry" onClick={() => setAddModal(true)} />
          </div>
          <div className="date-scroll">
            {dateOptions.map((dateValue) => (
              <button
                key={dateValue}
                type="button"
                className={`date-pill ${selectedDate === dateValue ? 'active' : ''}`}
                onClick={() => {
                  setSelectedDate(dateValue);
                  setApiDateUi(dateValue);
                }}
              >
                <span className="date-day">{format(new Date(dateValue), 'dd')}</span>
                <span className="date-week">{format(new Date(dateValue), 'EEE')}</span>
              </button>
            ))}
          </div>
          <div className="overflow-x-auto mt-4">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Date</th>
                  <th>Time In</th>
                  <th>Time Out</th>
                  <th>Status</th>
                  <th>Edit</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((row) => (
                  <tr key={row.key}>
                    <td>{row.empCode || '-'}</td>
                    <td>{row.name}</td>
                    <td>{row.date ? format(new Date(row.date), 'dd MMM yyyy') : '-'}</td>
                    <td>{row.timeIn || '-'}</td>
                    <td>{row.timeOut || '-'}</td>
                    <td>
                      <Badge
                        label={row.status || 'Present'}
                        variant={row.status === 'present' ? 'success' : row.status === 'absent' ? 'danger' : row.status === 'holiday' || row.status === 'festival' ? 'info' : 'warning'}
                      />
                    </td>
                    <td>
                      <button className="edit-btn" onClick={() => setEditModal(row)}>
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}


      <Modal isOpen={!!editModal} onClose={() => setEditModal(null)} title="Edit Attendance" size="md">
        {editModal && (
          <form onSubmit={handleSubmit(onEditSave)}>
            <div className="form-group">
              <label>Employee</label>
              <select {...register('employee')} className="form-select">
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.empCode} - {e.firstName} {e.lastName}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <Input label="Date IN" type="date" {...register('dateIn')} />
              <Input label="Time IN" type="time" {...register('timeIn')} />
            </div>
            <div className="form-row">
              <Input label="Date OUT" type="date" {...register('dateOut')} />
              <Input label="Time OUT" type="time" {...register('timeOut')} />
            </div>
            <div className="form-group">
              <label>Status</label>
              <select {...register('status')} className="form-select">
                <option value="present">Present</option>
                <option value="absent">Absent</option>
                <option value="holiday">Holiday</option>
                <option value="festival">Festival</option>
              </select>
            </div>
            <div className="modal-actions">
              <Button type="button" label="Cancel" variant="ghost" onClick={() => setEditModal(null)} />
              <Button type="submit" label="Save" />
            </div>
          </form>
        )}
      </Modal>
      <Modal isOpen={addModal} onClose={() => setAddModal(false)} title="Add Manual Entry" size="md">
        <form onSubmit={handleSubmit(onAddSave)}>
          <div className="form-group">
            <label>Employee</label>
            <select {...register('employee')} className="form-select">
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.empCode} - {e.firstName} {e.lastName}
                </option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <Input label="Date" type="date" {...register('dateIn')} />
            <Input label="Time IN" type="time" {...register('timeIn')} />
          </div>
          <div className="form-row">
            <Input label="Time OUT" type="time" {...register('timeOut')} />
            <Input label="Status" type="text" value="" style={{ display: 'none' }} readOnly />
          </div>
          <div className="form-group">
            <label>Status</label>
            <select {...register('status')} className="form-select">
              <option value="present">Present</option>
              <option value="absent">Absent</option>
              <option value="holiday">Holiday</option>
              <option value="festival">Festival</option>
            </select>
          </div>
          <div className="modal-actions">
            <Button type="button" label="Cancel" variant="ghost" onClick={() => setAddModal(false)} />
            <Button type="submit" label="Save" />
          </div>
        </form>
      </Modal>
    </div>
  );
}
